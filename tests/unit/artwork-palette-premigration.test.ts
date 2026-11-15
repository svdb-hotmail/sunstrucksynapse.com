import { PGlite } from "@electric-sql/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../../app/db/schema";
import { createArtworkPalettesRepository } from "../../app/repositories/artwork-palettes.server";
import {
  createCatalogueRepository,
  loadPublicCatalogue,
} from "../../app/repositories/catalogue.server";
import { createCurationOutboxRepository } from "../../app/repositories/curation-outbox.server";
import { seedDatabase } from "../../scripts/seed-data";

const assetId = "10000000-0000-4000-8000-000000000001";
const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });

describe("palette reader compatibility before migration 0017", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    // The historical database is real: no palette tables or functions exist.
    for (const migration of migrations.slice(0, 17)) {
      for (const statement of migration.sql) await client.exec(statement);
    }
    await seedDatabase(db);
  }, 30_000);
  afterAll(async () => {
    await client.close();
  });

  it("keeps published track, artist and release reads available with no palette schema", async () => {
    const repository = createCatalogueRepository(db);
    const tracks = await repository.listPublishedTracks();
    expect(tracks).toHaveLength(5);
    expect(tracks.every((track) => track.artwork.src && track.artwork.palette === undefined)).toBe(
      true,
    );
    const artist = await repository.findPublishedArtist("sunstruck-synapse");
    const release = await repository.findPublishedRelease("phase-zero-transmissions");
    expect(artist?.tracks).toHaveLength(5);
    expect(release?.tracks).toHaveLength(5);
    expect(artist?.artwork.palette).toBeUndefined();
    expect(release?.artwork.palette).toBeUndefined();
    expect((await loadPublicCatalogue(repository)).status).toBe("ready");
  });

  it("does not cache the missing-schema fallback after migration", async () => {
    const palettes = createArtworkPalettesRepository(db);
    const id = (
      await client.query<{ id: string }>(
        "select id from artwork_assets where status='ready' and scope='publishable_derivative' order by id limit 1",
      )
    ).rows[0].id;
    expect((await palettes.publicPalettes([id])).size).toBe(0);
    for (const statement of migrations[17].sql) await client.exec(statement);
    const source = await palettes.getSource(id);
    if (!source) throw new Error("Missing seeded artwork");
    await palettes.enqueue(id);
    const outbox = createCurationOutboxRepository(db);
    const job = (await outbox.claim({ limit: 1, kinds: ["artwork_palette_generate"] }))[0];
    const colors = {
      accent: "#8b2438",
      paperLight: "#fafafa",
      surfaceLight: "#ffffff",
      inkLight: "#111111",
      paperDark: "#111111",
      surfaceDark: "#222222",
      inkDark: "#ffffff",
    };
    expect(
      await palettes.persistReady({ jobId: job.id, leaseToken: job.leaseToken, source, colors }),
    ).toBe(true);
    expect((await palettes.publicPalettes([id])).get(id)).toEqual({
      version: 1,
      source: "generated",
      colors,
    });
  });
});

describe("palette missing-relation fallback stays narrow", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  beforeAll(() => {
    client = new PGlite();
    db = drizzle(client, { schema });
  });
  afterAll(async () => {
    await client.close();
  });
  async function resultFor(error: unknown) {
    const execute = vi.spyOn(db, "execute").mockRejectedValueOnce(error);
    try {
      return await createArtworkPalettesRepository(db).publicPalettes([assetId]);
    } finally {
      execute.mockRestore();
    }
  }
  it("recognizes the exact PostgreSQL relation on wrapped causes", async () => {
    const pg = Object.assign(new Error('relation "artwork_palette_overrides" does not exist'), {
      code: "42P01",
    });
    const wrapped = new Error(
      "Failed query: select artwork_palette_generations,artwork_palette_overrides",
      { cause: new Error("driver wrapper", { cause: pg }) },
    );
    expect((await resultFor(wrapped)).size).toBe(0);
    expect((await resultFor({ code: "42P01", table: "artwork_palette_generations" })).size).toBe(0);
  });
  it("does not combine an outer SQLSTATE with an unrelated cause message", async () => {
    const error = Object.assign(new Error("query failed"), {
      code: "42P01",
      cause: new Error('relation "artwork_palette_generations" does not exist'),
    });
    await expect(resultFor(error)).rejects.toBe(error);
  });
  it("rethrows unrelated missing relations even when wrapper SQL names both palette tables", async () => {
    const pg = Object.assign(new Error('relation "artwork_assets" does not exist'), {
      code: "42P01",
    });
    const wrapped = new Error(
      "Failed query: artwork_palette_generations join artwork_palette_overrides",
      { cause: pg },
    );
    await expect(resultFor(wrapped)).rejects.toBe(wrapped);
  });
  it("rethrows missing columns, network failures and nonexact relation names", async () => {
    for (const error of [
      Object.assign(new Error('relation "artwork_palette_generations" does not exist'), {
        code: "42703",
      }),
      Object.assign(new Error("connection reset"), { code: "ECONNRESET" }),
      Object.assign(new Error('relation "artwork_palette_generations_archive" does not exist'), {
        code: "42P01",
      }),
      Object.assign(
        new Error('Failed query includes relation "artwork_palette_overrides" does not exist'),
        { code: "42P01" },
      ),
    ])
      await expect(resultFor(error)).rejects.toBe(error);
  });
  it("rethrows cyclic cause chains and validates UUIDs before querying", async () => {
    const error: { cause?: unknown } = new Error("cycle");
    error.cause = error;
    await expect(resultFor(error)).rejects.toBe(error);
    const execute = vi.spyOn(db, "execute");
    try {
      await expect(createArtworkPalettesRepository(db).publicPalettes(["invalid"])).rejects.toThrow(
        "identifier",
      );
      expect(execute).not.toHaveBeenCalled();
    } finally {
      execute.mockRestore();
    }
  });
  it("does not suppress a real missing historical artwork table", async () => {
    await expect(createArtworkPalettesRepository(db).publicPalettes([assetId])).rejects.toThrow();
  });
});
