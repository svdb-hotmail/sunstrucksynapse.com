import { describe, expect, it, vi } from "vitest";
import {
  backfillArtworkPalettes,
  sanitizedDatabaseTarget,
} from "../../app/services/artwork-palette-backfill.server";
import type { ArtworkPaletteBackfillRow } from "../../app/repositories/artwork-palettes.server";
const row = (
  n: number,
  extra: Partial<ArtworkPaletteBackfillRow> = {},
): ArtworkPaletteBackfillRow => ({
  assetId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  objectKey: "/assets/a.png",
  storageProvider: "r2",
  checksumSha256: "a".repeat(64),
  mimeType: "image/png",
  byteSize: 12,
  algorithmVersion: 1,
  current: false,
  hasOverride: false,
  reviewedSlugs: [],
  ...extra,
});
describe("bounded artwork palette backfill", () => {
  it("defaults to metadata-only and deduplicates shared artwork with stable cursor", async () => {
    const enqueue = vi.fn();
    const processStatic = vi.fn();
    const selectBackfill = vi.fn().mockResolvedValue([row(1), row(1), row(2)]);
    const result = await backfillArtworkPalettes(
      { selectBackfill, enqueue },
      { environment: "development", limit: 3, after: row(0).assetId },
      new Set(),
      processStatic,
    );
    expect(selectBackfill).toHaveBeenCalledWith({ limit: 3, after: row(0).assetId });
    expect(result).toMatchObject({
      scanned: 2,
      eligible: 2,
      queued: 0,
      processed: 0,
      nextCursor: row(2).assetId,
    });
    expect(enqueue).not.toHaveBeenCalled();
    expect(processStatic).not.toHaveBeenCalled();
  });
  it("skips current generations, overrides and reviewed identities", async () => {
    const enqueue = vi.fn();
    const result = await backfillArtworkPalettes(
      {
        selectBackfill: async () => [
          row(1, { current: true }),
          row(2, { hasOverride: true }),
          row(3, { reviewedSlugs: ["reviewed"] }),
        ],
        enqueue,
      },
      { environment: "development", limit: 3, write: true },
      new Set(["reviewed"]),
      vi.fn(),
    );
    expect(result).toMatchObject({
      scanned: 3,
      current: 1,
      overrides: 1,
      reviewed: 1,
      eligible: 0,
    });
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("continues after one failure and distinguishes queued from generated", async () => {
    const enqueue = vi
      .fn()
      .mockRejectedValueOnce(new Error("secret details"))
      .mockResolvedValue("job");
    const processStatic = vi.fn().mockResolvedValue("processed");
    const result = await backfillArtworkPalettes(
      {
        selectBackfill: async () => [row(1), row(2), row(3, { storageProvider: "static" })],
        enqueue,
      },
      { environment: "development", limit: 3, write: true },
      new Set(),
      processStatic,
    );
    expect(result).toMatchObject({ failed: 1, queued: 1, processed: 1 });
    expect(result.failures).toEqual([{ assetId: row(1).assetId, code: "BACKFILL_ASSET_FAILED" }]);
  });
  it("requires explicit production write flag and sanitizes database target", async () => {
    const selectBackfill = vi.fn();
    await expect(
      backfillArtworkPalettes(
        { selectBackfill, enqueue: vi.fn() },
        { environment: "production", limit: 1, write: true },
        new Set(),
        vi.fn(),
      ),
    ).rejects.toThrow("confirm-production-writes");
    expect(selectBackfill).not.toHaveBeenCalled();
    expect(
      sanitizedDatabaseTarget("postgresql://user:password@db.example/catalogue?sslmode=require"),
    ).toEqual({ hostname: "db.example", database: "catalogue" });
  });
});
