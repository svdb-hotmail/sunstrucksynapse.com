import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import * as schema from "../../app/db/schema";
import { createCatalogueRepository } from "../../app/repositories/catalogue.server";
import { identityStyle } from "../../app/design-system/visual-identity";
import { reviewedIdentityPalettes } from "../../app/design-system/reviewed-identities";
import type { ArtworkPalette, PublicArtworkPalette } from "../../app/services/artwork-palette";
import Home from "../../app/routes/home";
import type { PlayerOutletContext } from "../../app/types/catalogue";
import { makeCatalogueItem } from "../fixtures/catalogue";
import { seedDatabase } from "../../scripts/seed-data";

const colors: ArtworkPalette = {
  accent: "#123456",
  paperLight: "#ffffff",
  surfaceLight: "#eeeeee",
  inkLight: "#111111",
  paperDark: "#111111",
  surfaceDark: "#222222",
  inkDark: "#ffffff",
};
const generated: PublicArtworkPalette = { version: 1, source: "generated", colors };

describe("durable artwork palette presentation", () => {
  it("prefers asset overrides, then reviewed identity, then generation, then skin", () => {
    expect(identityStyle("sunstruck-synapse", generated)?.["--identity-accent" as never]).toBe(
      reviewedIdentityPalettes["sunstruck-synapse"].accent,
    );
    expect(
      identityStyle("sunstruck-synapse", { ...generated, source: "override" })?.[
        "--identity-accent" as never
      ],
    ).toBe(colors.accent);
    expect(identityStyle("new-artist", generated)?.["--identity-accent" as never]).toBe(
      colors.accent,
    );
    expect(identityStyle("new-artist")).toBeUndefined();
  });

  it("renders featured palette in server markup", () => {
    const item = makeCatalogueItem("durable");
    item.artwork.palette = generated;
    const context: PlayerOutletContext = {
      catalogue: { status: "ready", items: [item], collections: [] },
      selectedItemId: null,
      selectItem: () => undefined,
      queueItem: () => undefined,
      playItem: () => undefined,
    };
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={context} />}>
            <Route path="/" element={<Home />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(markup).toContain("--identity-accent:#123456");
    expect(markup).toContain("--identity-paper-dark:#111111");
    expect(markup).toContain(item.artwork.src);
  });
});

describe("catalogue artwork palette association", () => {
  let client: PGlite;
  let repository: ReturnType<typeof createCatalogueRepository>;
  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedDatabase(db);
    repository = createCatalogueRepository(db);
  }, 30_000);
  afterAll(async () => {
    await client.close();
  });

  it("projects the palette of each chosen track, artist and release asset", async () => {
    const assets = (
      await client.query<{ id: string }>(
        "select id from artwork_assets where scope='publishable_derivative' and status='ready' order by id limit 3",
      )
    ).rows;
    const [trackAsset, artistAsset, releaseAsset] = assets.map(({ id }) => id);
    await client.query(
      "update track_artwork_assets set artwork_asset_id=$1 where track_id='30000000-0000-4000-8000-000000000102' and role='primary' and position=1",
      [trackAsset],
    );
    await client.query(
      "update artist_artwork_assets set artwork_asset_id=$1 where artist_id=(select id from artists where slug='sunstruck-synapse') and role='avatar' and position=1",
      [artistAsset],
    );
    await client.query(
      "update release_artwork_assets set artwork_asset_id=$1 where release_id=(select id from releases where slug='phase-zero-transmissions') and role='primary' and position=1",
      [releaseAsset],
    );
    for (const [index, assetId] of assets.map(({ id }, index) => [index, id] as const)) {
      await client.query(
        "insert into artwork_palette_overrides(artwork_asset_id,version,colors) values($1,1,$2::jsonb)",
        [assetId, JSON.stringify({ ...colors, accent: ["#123456", "#654321", "#234567"][index] })],
      );
    }
    const track = (await repository.listPublishedTracks()).find(
      ({ id }) => id === "30000000-0000-4000-8000-000000000102",
    );
    expect(track?.artwork.palette?.colors.accent).toBe("#123456");
    expect(
      (await repository.findPublishedArtist("sunstruck-synapse"))?.artwork.palette?.colors.accent,
    ).toBe("#654321");
    expect(
      (await repository.findPublishedRelease("phase-zero-transmissions"))?.artwork.palette?.colors
        .accent,
    ).toBe("#234567");
    expect(track?.artwork.palette?.source).toBe("override");
    await client.query("delete from artwork_palette_overrides");
    expect(
      (await repository.findPublishedRelease("phase-zero-transmissions"))?.artwork.palette,
    ).toBeUndefined();
  });
});
