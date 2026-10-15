import type { Database } from "~/db/client.server";
import type { WorkerEnv } from "~/config/env.server";
import { validateEncodingOutput } from "./encoding-contract";
import { createReleasePreparationRepository } from "~/repositories/release-preparation.server";

export async function prepareNextRelease(db: Database, env: WorkerEnv) {
  // Missing binding leaves the durable task waiting, without consuming retries.
  if (!env.AUDIO_ENCODER) return { state: "unconfigured" } as const;
  const repository = createReleasePreparationRepository(db);
  const job = await repository.claim();
  if (!job) return { state: "idle" } as const;
  try {
    const response = await env.AUDIO_ENCODER.fetch("https://encoder.internal/encode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(job),
      signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!response.ok) throw new Error("ENCODER_FAILED");
    const output = validateEncodingOutput(job, await response.json());
    const sealed = await env.MEDIA_BUCKET.head(output.objectKey);
    if (
      sealed?.size !== output.byteSize ||
      sealed.customMetadata?.checksumSha256 !== output.checksumSha256
    )
      throw new Error("OUTPUT_STORAGE_MISMATCH");
    if (!(await repository.complete(job, output))) throw new Error("LEASE_LOST");
    return { state: "ready" } as const;
  } catch (error) {
    const safeCodes = new Set([
      "OUTPUT_VERIFICATION_FAILED",
      "ENCODER_FAILED",
      "OUTPUT_STORAGE_MISMATCH",
      "LEASE_LOST",
    ]);
    const code =
      error instanceof Error && safeCodes.has(error.message)
        ? error.message
        : "PREPARATION_INTERRUPTED";
    await repository.fail(job, code);
    // The output key contains this lease token, so cleanup cannot delete a newer attempt.
    await env.MEDIA_BUCKET.delete(job.outputKey).catch(() => {});
    return { state: "failed", code } as const;
  }
}
