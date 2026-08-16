import { describe, expect, it, vi } from "vitest";

import {
  createStaticCatalogueRepository,
  loadPublicCatalogue,
} from "../../app/repositories/catalogue.server";
import { buildCatalogueSections, findCatalogueItem } from "../../app/services/catalogue";
import type { CatalogueRepository } from "../../app/repositories/catalogue.server";
import { makeCatalogueItem } from "../fixtures/catalogue";

describe("catalogue service", () => {
  const catalogueItems = [
    makeCatalogueItem("audio-one"),
    makeCatalogueItem("video-one", { mediaKind: "video" }),
    makeCatalogueItem("audio-two"),
  ];

  it("builds latest, audio and video sections from repository items", () => {
    const latestCollection = {
      id: "latest-id",
      slug: "latest-transmissions",
      name: "Latest transmissions",
      description: null,
      items: [catalogueItems[2]!, catalogueItems[0]!],
    };
    const sections = buildCatalogueSections(catalogueItems, [latestCollection]);

    expect(sections.map((section) => section.title)).toEqual([
      "Latest transmissions",
      "Listen",
      "Watch",
    ]);
    expect(sections[1]?.items.map((item) => item.id)).toEqual(["audio-one", "audio-two"]);
    expect(sections[2]?.items.map((item) => item.id)).toEqual(["video-one"]);
    expect(sections[0]?.items.map((item) => item.id)).toEqual(["audio-two", "audio-one"]);
  });

  it("finds an item without creating a parallel item instance", () => {
    expect(findCatalogueItem(catalogueItems, "video-one")).toBe(catalogueItems[1]);
    expect(findCatalogueItem(catalogueItems, "missing")).toBeUndefined();
  });

  it("reports ready and empty repository states", async () => {
    await expect(
      loadPublicCatalogue(createStaticCatalogueRepository(catalogueItems)),
    ).resolves.toEqual({
      status: "ready",
      items: catalogueItems,
      collections: [],
    });
    await expect(loadPublicCatalogue(createStaticCatalogueRepository([]))).resolves.toEqual({
      status: "empty",
      items: [],
      collections: [],
    });
  });

  it("returns a sanitized error state when the database read fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failingRepository: CatalogueRepository = {
      async listPublishedTracks() {
        throw new Error("database credential must not reach the client");
      },
      async listPublishedCollections() {
        return [];
      },
      async findPublishedArtist() {
        return null;
      },
      async findPublishedRelease() {
        return null;
      },
      async findPublishedTrack() {
        return null;
      },
    };

    await expect(loadPublicCatalogue(failingRepository)).resolves.toEqual({
      status: "error",
      items: [],
      collections: [],
      message: "The catalogue is temporarily unavailable. Please try again shortly.",
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
