import type { WorkerEnv } from "~/config/env.server";
import type { Database } from "~/db/client.server";
import {
  createArtworkPalettesRepository,
  type ArtworkPaletteSource,
} from "~/repositories/artwork-palettes.server";
import {
  createCurationOutboxRepository,
  type CurationOutboxClaimedRow,
} from "~/repositories/curation-outbox.server";
import { ALGORITHM_VERSION, parseArtworkPalette } from "./artwork-palette";

export const ARTWORK_PALETTE_JOB_KIND = "artwork_palette_generate";
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const SOURCE_FIELDS = [
  "assetId",
  "objectKey",
  "storageProvider",
  "checksumSha256",
  "mimeType",
  "byteSize",
  "algorithmVersion",
] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sourceFromPayload(value: Record<string, unknown>): ArtworkPaletteSource | null {
  if (
    typeof value.assetId !== "string" ||
    !UUID.test(value.assetId) ||
    typeof value.objectKey !== "string" ||
    !value.objectKey ||
    (value.storageProvider !== "r2" && value.storageProvider !== "static") ||
    typeof value.checksumSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.checksumSha256) ||
    typeof value.mimeType !== "string" ||
    !value.mimeType ||
    !Number.isSafeInteger(value.byteSize) ||
    Number(value.byteSize) < 1 ||
    Number(value.byteSize) > 20 * 1024 * 1024 ||
    value.algorithmVersion !== ALGORITHM_VERSION
  )
    return null;
  return Object.fromEntries(
    SOURCE_FIELDS.map((key) => [key, value[key]]),
  ) as unknown as ArtworkPaletteSource;
}

async function withinDeadline<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort!: () => void;
  const deadline = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("DECODER_TIMEOUT"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || Number(response.headers.get("content-length") ?? 0) > 4096)
    throw new Error("INVALID_DECODER_OUTPUT");
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const item = await reader.read();
      signal.throwIfAborted();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > 4096) throw new Error("INVALID_DECODER_OUTPUT");
      chunks.push(item.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
  }
}

type PaletteRepository = Pick<
  ReturnType<typeof createArtworkPalettesRepository>,
  "getSource" | "persistReady" | "persistFailed"
>;
type OutboxRepository = Pick<
  ReturnType<typeof createCurationOutboxRepository>,
  "acknowledge" | "retry" | "defer" | "fail"
>;

/** Does no network access except the exact database R2 key and private decoder binding. */
export async function processArtworkPaletteJob(
  job: CurationOutboxClaimedRow,
  env: WorkerEnv,
  palettes: PaletteRepository,
  outbox: OutboxRepository,
) {
  if (!env.AUDIO_ENCODER) {
    await outbox.defer(job.id, job.leaseToken, "ENCODER_UNAVAILABLE", 60);
    return { state: "unconfigured" } as const;
  }
  const source = sourceFromPayload(job.payload);
  if (!source || job.kind !== ARTWORK_PALETTE_JOB_KIND) {
    await outbox.fail(job.id, job.leaseToken, "INVALID_JOB_PAYLOAD");
    return { state: "failed", code: "INVALID_JOB_PAYLOAD" } as const;
  }
  const input = { jobId: job.id, leaseToken: job.leaseToken, source };
  let live: ArtworkPaletteSource | null;
  try {
    live = await palettes.getSource(source.assetId);
  } catch {
    await outbox.retry(job.id, job.leaseToken, "SOURCE_LOOKUP_FAILED", 60);
    return { state: "failed", code: "SOURCE_LOOKUP_FAILED" } as const;
  }
  if (!live || SOURCE_FIELDS.some((key) => live[key] !== source[key])) {
    await outbox.acknowledge(job.id, job.leaseToken);
    return { state: "obsolete" } as const;
  }
  const fail = async (code: string, terminal = false) => {
    // Source and lease CAS also guard failure writes; an old job cannot clear a new result.
    const persisted = await palettes.persistFailed({ ...input, errorCode: code });
    if (!persisted) {
      await outbox.acknowledge(job.id, job.leaseToken);
      return { state: "obsolete" } as const;
    }
    if (terminal) await outbox.fail(job.id, job.leaseToken, code);
    else await outbox.retry(job.id, job.leaseToken, code, 60);
    return { state: "failed", code } as const;
  };
  if (!MIME_TYPES.has(source.mimeType)) return fail("UNSUPPORTED_MIME_TYPE", true);
  if (source.storageProvider !== "r2") return fail("SOURCE_UNAVAILABLE", true);
  // Leave margin for database CAS and acknowledgement inside the 90-second lease.
  const signal = AbortSignal.timeout(45_000);
  let completionUncertain = false;
  try {
    const reading = env.MEDIA_BUCKET.get(source.objectKey, { range: new Headers() });
    // A platform read cannot be aborted, so release a body that arrives after our deadline.
    void reading
      .then((object) => {
        if (signal.aborted) void object?.body.cancel().catch(() => {});
      })
      .catch(() => {});
    const object = await withinDeadline(reading, signal);
    if (!object || object.size !== source.byteSize) {
      void object?.body.cancel().catch(() => {});
      return fail("SOURCE_STORAGE_MISMATCH", true);
    }
    const metadata = new Headers();
    object.writeHttpMetadata(metadata);
    if (metadata.get("content-type")?.split(";")[0].trim() !== source.mimeType) {
      void object.body.cancel().catch(() => {});
      return fail("SOURCE_STORAGE_MISMATCH", true);
    }
    signal.throwIfAborted();
    const response = await withinDeadline(
      env.AUDIO_ENCODER.fetch("https://encoder.internal/artwork-palette", {
        method: "POST",
        headers: {
          "content-type": source.mimeType,
          "content-length": String(source.byteSize),
          "x-source-checksum": source.checksumSha256,
        },
        body: object.body,
        signal,
      }),
      signal,
    );
    if (response.status === 409) {
      void response.body?.cancel().catch(() => {});
      await outbox.defer(job.id, job.leaseToken, "ENCODER_BUSY", 60);
      return { state: "deferred" } as const;
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      return fail("DECODER_FAILED");
    }
    const value = await withinDeadline(boundedJson(response, signal), signal);
    const output = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
    const colors = parseArtworkPalette(output?.colors);
    if (
      !output ||
      !colors ||
      output.version !== ALGORITHM_VERSION ||
      output.checksumSha256 !== source.checksumSha256 ||
      output.byteSize !== source.byteSize ||
      output.mimeType !== source.mimeType ||
      !Number.isSafeInteger(output.width) ||
      !Number.isSafeInteger(output.height) ||
      Number(output.width) < 1 ||
      Number(output.height) < 1 ||
      Number(output.width) > 10000 ||
      Number(output.height) > 10000 ||
      Number(output.width) * Number(output.height) > 40_000_000
    )
      return fail("INVALID_DECODER_OUTPUT");
    completionUncertain = true;
    const persisted = await palettes.persistReady({ ...input, colors });
    if (!persisted) {
      completionUncertain = false;
      await outbox.acknowledge(job.id, job.leaseToken);
      return { state: "obsolete" } as const;
    }
    const acknowledged = await outbox.acknowledge(job.id, job.leaseToken);
    completionUncertain = false;
    return { state: acknowledged ? "ready" : "lease_lost" } as const;
  } catch {
    if (completionUncertain) {
      // A committed ready write can lose its response. Never replace it with failed.
      await outbox.retry(job.id, job.leaseToken, "COMPLETION_UNCERTAIN", 60);
      return { state: "failed", code: "COMPLETION_UNCERTAIN" } as const;
    }
    return fail(signal.aborted ? "DECODER_TIMEOUT" : "PALETTE_GENERATION_FAILED");
  }
}

export async function prepareNextArtworkPalette(db: Database, env: WorkerEnv) {
  // Do not even claim work until the private decoder is deployed and bound.
  if (!env.AUDIO_ENCODER) return { state: "unconfigured" } as const;
  const outbox = createCurationOutboxRepository(db);
  const [job] = await outbox.claim({
    kinds: [ARTWORK_PALETTE_JOB_KIND],
    sourceStorageProvider: "r2",
    limit: 1,
    leaseSeconds: 90,
  });
  if (!job) return { state: "idle" } as const;
  return processArtworkPaletteJob(job, env, createArtworkPalettesRepository(db), outbox);
}
