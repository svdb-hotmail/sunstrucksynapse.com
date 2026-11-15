import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ArtworkPaletteBackfillRow,
  ArtworkPaletteSource,
  ArtworkPalettePersistenceInput,
} from "../repositories/artwork-palettes.server";
import { parseArtworkPalette, type ArtworkPalette } from "./artwork-palette";

/** Real-path confinement and provenance checks precede local decoder invocation. */
export async function decodeStaticArtwork(
  source: ArtworkPaletteSource,
  publicDirectory = path.resolve("public"),
): Promise<ArtworkPalette> {
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(source.mimeType))
    throw new Error("UNSUPPORTED_SOURCE");
  const root = await realpath(publicDirectory);
  if (
    !source.objectKey ||
    source.objectKey.startsWith("//") ||
    source.objectKey.includes("\\") ||
    source.objectKey.includes("\0")
  )
    throw new Error("INVALID_SOURCE");
  const file = await realpath(
    path.resolve(
      root,
      source.objectKey.startsWith("/") ? `.${source.objectKey}` : source.objectKey,
    ),
  );
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error("INVALID_SOURCE");
  const info = await stat(file);
  if (
    !info.isFile() ||
    info.size !== source.byteSize ||
    info.size > 20 * 1024 * 1024 ||
    info.size < 1
  )
    throw new Error("SOURCE_MISMATCH");
  const bytes = await readFile(file);
  if (createHash("sha256").update(bytes).digest("hex") !== source.checksumSha256)
    throw new Error("SOURCE_MISMATCH");
  const code =
    "import sys,json,pathlib;sys.path.insert(0,sys.argv[1]);from server import extract_artwork_palette;print(json.dumps(extract_artwork_palette(pathlib.Path(sys.argv[2]),sys.argv[3])))";
  const { stdout } = await promisify(execFile)(
    "python3",
    ["-c", code, path.resolve("services/encoder"), file, source.mimeType],
    { timeout: 45_000, maxBuffer: 16_384 },
  );
  const result = JSON.parse(stdout) as Record<string, unknown>;
  const colors = parseArtworkPalette(result.colors);
  if (
    result.version !== 1 ||
    !colors ||
    result.checksumSha256 !== source.checksumSha256 ||
    result.byteSize !== source.byteSize ||
    result.mimeType !== source.mimeType ||
    !Number.isSafeInteger(result.width) ||
    !Number.isSafeInteger(result.height) ||
    Number(result.width) < 1 ||
    Number(result.height) < 1 ||
    Number(result.width) > 10000 ||
    Number(result.height) > 10000 ||
    Number(result.width) * Number(result.height) > 40_000_000
  )
    throw new Error("DECODER_MISMATCH");
  return colors;
}
export interface StaticPaletteBackfillDependencies {
  claimExact(jobId: string, source: ArtworkPaletteSource): Promise<string | null>;
  decode(source: ArtworkPaletteSource): Promise<ArtworkPalette>;
  palettes: {
    persistReady(input: ArtworkPalettePersistenceInput & { colors: unknown }): Promise<boolean>;
    persistFailed(input: ArtworkPalettePersistenceInput & { errorCode: string }): Promise<boolean>;
  };
  outbox: {
    acknowledge(id: string, token: string): Promise<boolean>;
    fail(id: string, token: string, code: string): Promise<boolean>;
    retry(id: string, token: string, code: string, delay: number): Promise<boolean>;
  };
}
/** Exact-job source fencing prevents a stale scan from poisoning a replacement job. */
export function createStaticArtworkPaletteProcessor(
  dependencies: StaticPaletteBackfillDependencies,
) {
  return async (row: ArtworkPaletteBackfillRow, jobId: string): Promise<"processed" | "queued"> => {
    const source: ArtworkPaletteSource = {
      assetId: row.assetId,
      objectKey: row.objectKey,
      storageProvider: row.storageProvider,
      checksumSha256: row.checksumSha256,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      algorithmVersion: row.algorithmVersion,
    };
    const leaseToken = await dependencies.claimExact(jobId, source);
    if (!leaseToken) return "queued";
    let completionUncertain = false;
    try {
      const colors = await dependencies.decode(source);
      completionUncertain = true;
      if (!(await dependencies.palettes.persistReady({ jobId, leaseToken, source, colors }))) {
        completionUncertain = false;
        await dependencies.outbox.acknowledge(jobId, leaseToken);
        return "queued";
      }
      if (!(await dependencies.outbox.acknowledge(jobId, leaseToken)))
        throw new Error("LEASE_OR_SOURCE_CHANGED");
      completionUncertain = false;
      return "processed";
    } catch (error) {
      if (completionUncertain) {
        await dependencies.outbox.retry(jobId, leaseToken, "COMPLETION_UNCERTAIN", 60);
        throw new Error("COMPLETION_UNCERTAIN");
      }
      const code =
        error instanceof Error && error.message === "UNSUPPORTED_SOURCE"
          ? "UNSUPPORTED_SOURCE"
          : "STATIC_SOURCE_FAILED";
      await dependencies.palettes.persistFailed({ jobId, leaseToken, source, errorCode: code });
      await dependencies.outbox.fail(jobId, leaseToken, code);
      throw new Error(code);
    }
  };
}
