import type { ArtworkPaletteBackfillRow } from "../repositories/artwork-palettes.server";

export interface PaletteBackfillOptions {
  environment: "development" | "production";
  limit: number;
  after?: string;
  write?: boolean;
  confirmProductionWrites?: boolean;
  requeueFailed?: boolean;
}
export interface PaletteBackfillRepository {
  selectBackfill(options: { limit: number; after?: string }): Promise<ArtworkPaletteBackfillRow[]>;
  enqueue(assetId: string, options?: { requeueFailed?: boolean }): Promise<string | null>;
}
export function validatePaletteBackfillOptions(options: PaletteBackfillOptions): void {
  if (options.environment !== "development" && options.environment !== "production")
    throw new Error("Explicit environment required.");
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000)
    throw new Error("Limit must be between 1 and 1000.");
  if (
    options.after &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      options.after,
    )
  )
    throw new Error("Invalid cursor.");
  if (options.write && options.environment === "production" && !options.confirmProductionWrites)
    throw new Error("Production writes require --confirm-production-writes after human approval.");
}
export function sanitizedDatabaseTarget(value: string): { hostname: string; database: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid database target.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
    throw new Error("Invalid database target.");
  return { hostname: url.hostname, database: decodeURIComponent(url.pathname.slice(1)) };
}

/** Dry runs only select metadata: neither enqueue nor processStatic is called. */
export async function backfillArtworkPalettes(
  repository: PaletteBackfillRepository,
  options: PaletteBackfillOptions,
  reviewedSlugs: ReadonlySet<string>,
  processStatic: (row: ArtworkPaletteBackfillRow, jobId: string) => Promise<"processed" | "queued">,
) {
  validatePaletteBackfillOptions(options);
  const report = {
    environment: options.environment,
    mode: options.write ? "write" : "dry-run",
    scanned: 0,
    eligible: 0,
    current: 0,
    overrides: 0,
    reviewed: 0,
    queued: 0,
    processed: 0,
    unchanged: 0,
    failed: 0,
    nextCursor: null as string | null,
    failures: [] as { assetId: string; code: string }[],
  };
  const rows = await repository.selectBackfill({ limit: options.limit, after: options.after });
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.assetId)) continue;
    seen.add(row.assetId);
    report.scanned++;
    report.nextCursor = row.assetId;
    if (row.hasOverride) {
      report.overrides++;
      continue;
    }
    if (row.reviewedSlugs.some((slug) => reviewedSlugs.has(slug))) {
      report.reviewed++;
      continue;
    }
    if (row.current) {
      report.current++;
      continue;
    }
    report.eligible++;
    if (!options.write) continue;
    try {
      const jobId = await repository.enqueue(row.assetId, { requeueFailed: options.requeueFailed });
      if (!jobId) {
        report.unchanged++;
        continue;
      }
      if (row.storageProvider === "r2") {
        report.queued++;
        continue;
      }
      const outcome = await processStatic(row, jobId);
      report[outcome]++;
    } catch (error) {
      report.failed++;
      const safeCodes = new Set([
        "UNSUPPORTED_SOURCE",
        "STATIC_SOURCE_FAILED",
        "COMPLETION_UNCERTAIN",
      ]);
      const code =
        error instanceof Error && safeCodes.has(error.message)
          ? error.message
          : "BACKFILL_ASSET_FAILED";
      report.failures.push({ assetId: row.assetId, code });
    }
  }
  return report;
}
