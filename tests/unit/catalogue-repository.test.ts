import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../../app/db/schema";
import { createCatalogueRepository } from "../../app/repositories/catalogue.server";
import { seedDatabase } from "../../scripts/seed-data";

describe("catalogue repository", () => {
  let client: PGlite;
  let repository: ReturnType<typeof createCatalogueRepository>;

  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedDatabase(db);
    await seedDatabase(db);
    repository = createCatalogueRepository(db);
  }, 30_000);

  afterAll(async () => {
    await client.close();
  });

  it("returns the five rights-cleared production tracks with track-specific media and artwork", async () => {
    const items = await repository.listPublishedTracks();

    expect(items).toHaveLength(5);
    expect(items.map((item) => item.description.title)).toEqual([
      "AI Pop-Slop 202607190035",
      "Sunstruck Synapse (Revolution will be televised)",
      "Final Movie 00007",
      "The Mushroom Circle (Gnome Revolution)",
      "Gone Fishing",
    ]);
    expect(new Set(items.map((item) => item.artwork.src)).size).toBe(5);
    expect(items.every((item) => item.media?.src.startsWith("/assets/"))).toBe(true);
    expect(JSON.stringify(items)).not.toContain("private");
  });

  it("does not expose archived catalogue records or private media", async () => {
    await expect(repository.findPublishedArtist("synthetic-dawn-ensemble")).resolves.toBeNull();
    await expect(repository.findPublishedRelease("signals-before-sunrise")).resolves.toBeNull();
    await expect(
      repository.findPublishedTrack("signals-before-sunrise", "first-light"),
    ).resolves.toBeNull();
  });

  it("resolves stable public artist, release and track slugs", async () => {
    const artist = await repository.findPublishedArtist("sunstruck-synapse");
    const release = await repository.findPublishedRelease("phase-zero-transmissions");
    const track = await repository.findPublishedTrack(
      "phase-zero-transmissions",
      "revolution-will-be-televised",
    );

    expect(artist?.tracks).toHaveLength(5);
    expect(release?.tracks).toHaveLength(5);
    expect(track?.item.href).toBe("/tracks/phase-zero-transmissions/revolution-will-be-televised");
    expect(track?.item.media?.src).toBe(
      "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
    );
  });
});
