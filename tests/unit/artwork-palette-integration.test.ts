import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { deflateSync } from "node:zlib";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkerEnv } from "../../app/config/env.server";
import * as schema from "../../app/db/schema";
import { createArtworkPalettesRepository } from "../../app/repositories/artwork-palettes.server";
import { createCatalogueRepository } from "../../app/repositories/catalogue.server";
import { createCurationOutboxRepository } from "../../app/repositories/curation-outbox.server";
import { parseArtworkPalette, type ArtworkPalette } from "../../app/services/artwork-palette";
import { processArtworkPaletteJob } from "../../app/services/artwork-palette-generation.server";
import { seedDatabase } from "../../scripts/seed-data";

const runFile = promisify(execFile);
const trackId = "30000000-0000-4000-8000-000000000102";
const assetId = "40000000-0000-4000-8000-000000000999";

// Tiny synthetic fixtures, encoded here to avoid a binary fixture or another image dependency.
function png(red: number, green: number, blue: number): Buffer {
  function chunk(kind: string, bytes: Buffer): Buffer {
    const payload = Buffer.concat([Buffer.from(kind), bytes]);
    let crc = 0xffffffff;
    for (const byte of payload) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, payload, checksum]);
  }
  const width = 96,
    height = 64;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * (1 + width * 3) + 1 + x * 3;
      pixels.set([red, green, blue], offset);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("real artwork palette generation across decoder, persistence and catalogue", () => {
  let client: PGlite;
  let temporaryDirectory: string;
  let palettes: ReturnType<typeof createArtworkPalettesRepository>;
  let outbox: ReturnType<typeof createCurationOutboxRepository>;
  let catalogue: ReturnType<typeof createCatalogueRepository>;

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "sunsyn-palette-integration-"));
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedDatabase(db);
    palettes = createArtworkPalettesRepository(db);
    outbox = createCurationOutboxRepository(db);
    catalogue = createCatalogueRepository(db, { signingSecret: "local-integration-secret" });
    // Seeded legacy metadata is deliberately not automatically backfilled.
    await client.exec("update artwork_palette_settings set enable_new_artwork=true");
  }, 30_000);

  afterAll(async () => {
    await client?.close();
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("publishes real extracted colors and rejects a decoded result after source replacement", async () => {
    const blue = png(32, 64, 192),
      red = png(192, 48, 32);
    const files = new Map([
      ["public/artwork/integration-blue.png", blue],
      ["public/artwork/integration-red.png", red],
    ]);
    const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
    let decoderCalls = 0;
    let pauseAfterDecode: (() => Promise<void>) | undefined;
    const extracted: ArtworkPalette[] = [];
    const env: WorkerEnv = {
      DATABASE_URL: "postgres://unused/local-only",
      ACCESS_TEAM_DOMAIN: "https://local.cloudflareaccess.com",
      ACCESS_AUD: "local",
      CURATOR_EMAILS: "curator@example.test",
      MEDIA_DELIVERY_SIGNING_SECRET: "local-integration-secret",
      MEDIA_BUCKET: {
        async get(key) {
          const bytes = files.get(key);
          if (!bytes) return null;
          return {
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array(bytes));
                controller.close();
              },
            }),
            size: bytes.length,
            httpEtag: '"synthetic"',
            writeHttpMetadata(headers) {
              headers.set("content-type", "image/png");
            },
          };
        },
        async put() {
          throw new Error("This fixture must never write R2.");
        },
        async head() {
          throw new Error("Unexpected storage access.");
        },
        async delete() {
          throw new Error("Unexpected storage mutation.");
        },
      },
      AUDIO_ENCODER: {
        async fetch(input, init) {
          expect(String(input)).toBe("https://encoder.internal/artwork-palette");
          const headers = new Headers(init?.headers);
          const bytes = Buffer.from(await new Response(init?.body).arrayBuffer());
          expect(headers.get("content-type")).toBe("image/png");
          expect(headers.get("content-length")).toBe(String(bytes.length));
          expect(headers.get("x-source-checksum")).toBe(hash(bytes));
          const file = path.join(temporaryDirectory, `source-${++decoderCalls}.png`);
          await writeFile(file, bytes);
          const code =
            "import sys,json,pathlib;sys.path.insert(0,sys.argv[1]);from server import extract_artwork_palette;print(json.dumps(extract_artwork_palette(pathlib.Path(sys.argv[2]),'image/png')))";
          const { stdout } = await runFile(
            "python3",
            ["-c", code, path.resolve("services/encoder"), file],
            { timeout: 20_000, maxBuffer: 4096 },
          );
          const output = JSON.parse(stdout) as { colors: unknown };
          const colors = parseArtworkPalette(output.colors);
          expect(colors).not.toBeNull();
          extracted.push(colors!);
          await pauseAfterDecode?.();
          return Response.json(output);
        },
      },
    };

    await client.query(
      `insert into artwork_assets(id,object_key,storage_provider,scope,status,mime_type,checksum_sha256,byte_size,width,height)
      values($1,$2,'r2','publishable_derivative','ready','image/png',$3,$4,96,64)`,
      [assetId, "public/artwork/integration-blue.png", hash(blue), blue.length],
    );
    await client.query(
      "update track_artwork_assets set artwork_asset_id=$1 where track_id=$2 and role='primary' and position=1",
      [assetId, trackId],
    );
    const [firstJob] = await outbox.claim({
      kinds: ["artwork_palette_generate"],
      limit: 1,
      leaseSeconds: 90,
    });
    expect(firstJob.payload.generationRevision).toBe(1);
    expect(await processArtworkPaletteJob(firstJob, env, palettes, outbox)).toEqual({
      state: "ready",
    });
    const persisted = await client.query<{
      status: string;
      source_object_key: string;
      source_checksum_sha256: string;
      source_byte_size: number;
      algorithm_version: number;
      colors: ArtworkPalette;
    }>(
      "select status,source_object_key,source_checksum_sha256,source_byte_size::integer,algorithm_version,colors from artwork_palette_generations where artwork_asset_id=$1",
      [assetId],
    );
    expect(persisted.rows[0]).toEqual({
      status: "ready",
      source_object_key: "public/artwork/integration-blue.png",
      source_checksum_sha256: hash(blue),
      source_byte_size: blue.length,
      algorithm_version: 1,
      colors: extracted[0],
    });
    const firstTrack = (await catalogue.listPublishedTracks()).find(({ id }) => id === trackId);
    expect(firstTrack?.artwork.src).toContain(`/media/artwork/${assetId}`);
    expect(firstTrack?.artwork.palette).toEqual({
      version: 1,
      source: "generated",
      colors: extracted[0],
    });

    await client.query(
      "update artwork_assets set object_key=$2,checksum_sha256=$3,byte_size=$4 where id=$1",
      [assetId, "public/artwork/integration-red.png", hash(red), red.length],
    );
    const [oldJob] = await outbox.claim({
      kinds: ["artwork_palette_generate"],
      limit: 1,
      leaseSeconds: 90,
    });
    expect(oldJob.payload.generationRevision).toBe(2);
    const decoded = deferred(),
      release = deferred();
    pauseAfterDecode = async () => {
      decoded.resolve();
      await release.promise;
    };
    const oldCompletion = processArtworkPaletteJob(oldJob, env, palettes, outbox);
    await Promise.race([
      decoded.promise,
      oldCompletion.then((outcome) => {
        throw new Error(`Decode did not reach replacement barrier: ${outcome.state}`);
      }),
    ]);
    try {
      // Return to a previously successful identity while the old red decode is in flight.
      await client.query(
        "update artwork_assets set object_key=$2,checksum_sha256=$3,byte_size=$4 where id=$1",
        [assetId, "public/artwork/integration-blue.png", hash(blue), blue.length],
      );
    } finally {
      release.resolve();
    }
    expect(await oldCompletion).toEqual({ state: "obsolete" });
    expect(extracted[1]).not.toEqual(extracted[0]);
    expect(
      (await catalogue.listPublishedTracks()).find(({ id }) => id === trackId)?.artwork.palette,
    ).toBeUndefined();
    const generation = await client.query<{ status: string; generation_revision: number }>(
      "select status,generation_revision from artwork_palette_generations where artwork_asset_id=$1",
      [assetId],
    );
    expect(generation.rows[0]).toEqual({ status: "pending", generation_revision: 3 });

    pauseAfterDecode = undefined;
    const [currentJob] = await outbox.claim({
      kinds: ["artwork_palette_generate"],
      limit: 1,
      leaseSeconds: 90,
    });
    expect(currentJob.payload.generationRevision).toBe(3);
    expect(await processArtworkPaletteJob(currentJob, env, palettes, outbox)).toEqual({
      state: "ready",
    });
    expect(
      (await catalogue.listPublishedTracks()).find(({ id }) => id === trackId)?.artwork.palette,
    ).toEqual({ version: 1, source: "generated", colors: extracted[0] });
    expect(decoderCalls).toBe(3);
    expect(
      (
        await client.query<{ status: string }>("select status from curation_outbox where id=$1", [
          firstJob.id,
        ])
      ).rows[0].status,
    ).toBe("succeeded");
  }, 60_000);
});
