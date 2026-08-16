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

  it("serves configured homepage collections in database order without private or unpublished content", async () => {
    await client.exec(`
      insert into editorial_collections (
        id, slug, name, lifecycle_status
      ) values (
        '60000000-0000-4000-8000-000000000199',
        'draft-selection',
        'Draft selection',
        'draft'
      );
      insert into collection_items (
        id, collection_id, track_id, position
      ) values (
        '61000000-0000-4000-8000-000000000199',
        '60000000-0000-4000-8000-000000000199',
        '30000000-0000-4000-8000-000000000102',
        1
      );
    `);

    const collections = await repository.listPublishedCollections();

    expect(collections.map(({ slug }) => slug)).toEqual([
      "latest-transmissions",
      "listen",
      "watch",
    ]);
    expect(collections[0]?.items.map((item) => item.id)).toEqual([
      "30000000-0000-4000-8000-000000000101",
      "30000000-0000-4000-8000-000000000102",
      "30000000-0000-4000-8000-000000000103",
      "30000000-0000-4000-8000-000000000104",
    ]);
    expect(collections[1]?.items.map((item) => item.id)).toEqual([
      "30000000-0000-4000-8000-000000000102",
      "30000000-0000-4000-8000-000000000104",
    ]);
    expect(collections[2]?.items.map((item) => item.id)).toEqual([
      "30000000-0000-4000-8000-000000000101",
      "30000000-0000-4000-8000-000000000103",
      "30000000-0000-4000-8000-000000000105",
    ]);
    expect(JSON.stringify(collections)).not.toMatch(/draft-selection|private/);
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
    expect(track?.reviewedDisclosureHref).toBe(
      "/tracks/phase-zero-transmissions/revolution-will-be-televised/disclosure",
    );
  });

  it("returns the pinned public disclosure revision without exposing private evidence keys", async () => {
    const disclosure = await repository.findPublicTrackDisclosure(
      "phase-zero-transmissions",
      "revolution-will-be-televised",
    );

    expect(disclosure).toMatchObject({
      artistName: "Sunstruck Synapse",
      rights: {
        authorityBasis: "original_author",
        territories: ["Worldwide"],
      },
      process: {
        aiUsed: true,
      },
    });
    expect(JSON.stringify(disclosure)).not.toContain("private/evidence/");
  });

  it("includes a multiply credited track on both published artist pages", async () => {
    await client.exec(`
      insert into artists (
        id, slug, display_name, lifecycle_status, published_at
      ) values (
        '10000000-0000-4000-8000-000000000201',
        'secondary-artist',
        'Secondary Artist',
        'published',
        '2026-01-15T12:00:00.000Z'
      );
      insert into track_artist_credits (
        id, track_id, artist_id, position, credited_as
      ) values (
        '11000000-0000-4000-8000-000000000201',
        '30000000-0000-4000-8000-000000000102',
        '10000000-0000-4000-8000-000000000201',
        2,
        'Secondary Artist'
      );
    `);

    const primary = await repository.findPublishedArtist("sunstruck-synapse");
    const secondary = await repository.findPublishedArtist("secondary-artist");

    expect(primary?.tracks.map((track) => track.id)).toContain(
      "30000000-0000-4000-8000-000000000102",
    );
    expect(secondary?.tracks.map((track) => track.id)).toEqual([
      "30000000-0000-4000-8000-000000000102",
    ]);
    expect(secondary?.tracks[0]?.creator.slug).toBe("sunstruck-synapse");
  });

  it("orders dated releases newest-first, puts undated releases last, and preserves track order", async () => {
    await client.exec(`
      begin;
      insert into artists (
        id, slug, display_name, lifecycle_status, published_at
      ) values (
        '10000000-0000-4000-8000-000000000301',
        'ordering-artist',
        'Ordering Artist',
        'published',
        '2026-01-15T12:00:00.000Z'
      );
      insert into releases (
        id, slug, title, release_date, lifecycle_status, published_at
      ) values
        ('20000000-0000-4000-8000-000000000301', 'newer-release', 'Newer Release', '2027-01-01', 'published', '2026-01-15T12:00:00.000Z'),
        ('20000000-0000-4000-8000-000000000302', 'older-release', 'Older Release', '2025-01-01', 'published', '2026-01-15T12:00:00.000Z'),
        ('20000000-0000-4000-8000-000000000303', 'undated-release', 'Undated Release', null, 'published', '2026-01-15T12:00:00.000Z');
      insert into release_artist_credits (
        release_id, artist_id, position
      ) values
        ('20000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000301', 1),
        ('20000000-0000-4000-8000-000000000302', '10000000-0000-4000-8000-000000000301', 1),
        ('20000000-0000-4000-8000-000000000303', '10000000-0000-4000-8000-000000000301', 1);
      insert into tracks (
        id, release_id, slug, title, disc_number, position, lifecycle_status, published_at
      ) values
        ('30000000-0000-4000-8000-000000000301', '20000000-0000-4000-8000-000000000301', 'newer-first', 'Newer First', 1, 1, 'published', '2026-01-15T12:00:00.000Z'),
        ('30000000-0000-4000-8000-000000000302', '20000000-0000-4000-8000-000000000301', 'newer-second', 'Newer Second', 1, 2, 'published', '2026-01-15T12:00:00.000Z'),
        ('30000000-0000-4000-8000-000000000303', '20000000-0000-4000-8000-000000000302', 'older-track', 'Older Track', 1, 1, 'published', '2026-01-15T12:00:00.000Z'),
        ('30000000-0000-4000-8000-000000000304', '20000000-0000-4000-8000-000000000303', 'undated-track', 'Undated Track', 1, 1, 'published', '2026-01-15T12:00:00.000Z');
      insert into track_artist_credits (
        track_id, artist_id, position
      ) values
        ('30000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000301', 1),
        ('30000000-0000-4000-8000-000000000302', '10000000-0000-4000-8000-000000000301', 1),
        ('30000000-0000-4000-8000-000000000303', '10000000-0000-4000-8000-000000000301', 1),
        ('30000000-0000-4000-8000-000000000304', '10000000-0000-4000-8000-000000000301', 1);
      commit;
    `);

    const items = await repository.listPublishedTracks();
    const releaseOrder = [...new Set(items.map((item) => item.release.slug))];

    expect(releaseOrder).toEqual([
      "newer-release",
      "phase-zero-transmissions",
      "older-release",
      "undated-release",
    ]);
    expect(
      items.filter((item) => item.release.slug === "newer-release").map((item) => item.slug),
    ).toEqual(["newer-first", "newer-second"]);
  });
});
