import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../../app/db/schema";
import type { Database } from "../../app/db/client.server";
import { seedDatabase, seedIds } from "../../scripts/seed-data";
import { createCuratorCatalogueRepository } from "../../app/repositories/curator-catalogue.server";
import {
  parseCatalogueQuery,
  catalogueExplanation,
  catalogueVisibility,
} from "../../app/services/curator-catalogue";
import type { CatalogueQuery } from "../../app/types/curator-catalogue";

const all: CatalogueQuery = { query: "", view: "all", after: null, trackId: null };
describe("curator catalogue database read model", () => {
  let client: PGlite;
  let repository: ReturnType<typeof createCuratorCatalogueRepository>;
  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedDatabase(db);
    repository = createCuratorCatalogueRepository(db as unknown as Database);
  }, 30000);
  beforeEach(async () => {
    await client.exec("begin");
  });
  afterEach(async () => {
    await client.exec("rollback");
  });
  afterAll(async () => {
    await client.close();
  });

  it("matches public lifecycle visibility and flags unavailable parent records", async () => {
    const id = seedIds.productionTracks[0];
    const live = await repository.read({ ...all, trackId: id });
    expect(live.selected).toMatchObject({
      publiclyListed: true,
      publicMediaReady: true,
      state: "live",
    });
    await client.query(
      "update releases set lifecycle_status='draft',published_at=null where id=$1",
      [seedIds.productionRelease],
    );
    const hidden = await repository.read({ ...all, trackId: id });
    expect(hidden.selected).toMatchObject({
      publiclyListed: false,
      lifecycleStatus: "published",
      state: "attention",
    });
    expect(catalogueExplanation(hidden.selected!)).toContain("required public parent");
    expect(hidden.counts.attention).toBeGreaterThan(live.counts.attention);
  });

  it("retains a listed track with unavailable media as an attention item", async () => {
    const id = seedIds.productionTracks[0];
    await client.query("update audio_assets set status='deleted' where track_id=$1", [id]);
    await client.query("update video_assets set status='deleted' where track_id=$1", [id]);
    const page = await repository.read({ ...all, trackId: id });
    expect(page.selected).toMatchObject({
      publiclyListed: true,
      publicMediaReady: false,
      state: "attention",
    });
    expect(catalogueVisibility(page.selected!)).toBe("Listed · media unavailable");
  });

  it("does not lose pending tracks when the release alone is published", async () => {
    const id = seedIds.productionTracks[0];
    await client.query("update tracks set lifecycle_status='draft',published_at=null where id=$1", [
      id,
    ]);
    const page = await repository.read({ ...all, view: null, trackId: id });
    expect(page.view).toBe("attention");
    expect(page.selected).toMatchObject({
      publiclyListed: false,
      releaseStatus: "published",
      state: "attention",
    });
    expect(catalogueExplanation(page.selected!)).toContain("release is marked published");
  });

  it("distinguishes future scheduled tracks from overdue records", async () => {
    const id = seedIds.productionTracks[0];
    await client.query(
      "update tracks set lifecycle_status='scheduled',published_at=null,scheduled_for=now()+interval '1 day' where id=$1",
      [id],
    );
    expect((await repository.read({ ...all, trackId: id })).selected?.state).toBe("scheduled");
    await client.query("update tracks set scheduled_for=now()-interval '1 day' where id=$1", [id]);
    expect((await repository.read({ ...all, trackId: id })).selected?.state).toBe("attention");
  });

  it("uses stable keyset pagination and server-wide facets, including an off-page selection", async () => {
    for (let i = 0; i < 30; i++) {
      await client.query(
        "insert into tracks(id,release_id,title,slug,position) values($1,$2,$3,$4,$5)",
        [
          crypto.randomUUID(),
          seedIds.productionRelease,
          `Pagination ${String(i).padStart(2, "0")}`,
          `pagination-${i}`,
          100 + i,
        ],
      );
    }
    const first = await repository.read({ ...all, query: "Pagination" });
    expect(first.items).toHaveLength(25);
    expect(first.counts.all).toBe(30);
    expect(first.counts.attention).toBe(30);
    expect(first.next).not.toBeNull();
    const next = await repository.read({
      ...all,
      query: "Pagination",
      after: first.next,
      trackId: first.items[0].id,
    });
    expect(next.items).toHaveLength(5);
    expect(next.counts.all).toBe(30);
    expect(next.selected?.id).toBe(first.items[0].id);
    expect(next.items.some((t) => first.items.some((previous) => t.id === previous.id))).toBe(
      false,
    );
    expect(next.next).toBeNull();
  });
});

describe("catalogue request boundary", () => {
  it.each([
    "view=unknown",
    "track=not-a-uuid",
    "after=%7B",
    "after=null",
    "after=%7B%22title%22%3A1%7D",
  ])("rejects invalid query %s", (value) => {
    expect(() => parseCatalogueQuery(new URLSearchParams(value))).toThrow();
  });
  it("treats wildcard characters as literal search input and bounds query size", () => {
    expect(parseCatalogueQuery(new URLSearchParams("q=%25_")).query).toBe("%_");
    expect(() => parseCatalogueQuery(new URLSearchParams({ q: "a".repeat(201) }))).toThrow();
  });
});
