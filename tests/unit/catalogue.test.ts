import { describe, expect, it } from "vitest";

import {
  catalogueItems,
  catalogueSections,
  getCatalogueItem,
  initialCatalogueItem,
} from "../../app/data/catalogue";

describe("catalogue fixtures", () => {
  it("keeps item identifiers unique and every section reference canonical", () => {
    const itemIds = catalogueItems.map(({ id }) => id);

    expect(new Set(itemIds).size).toBe(itemIds.length);
    for (const section of catalogueSections) {
      for (const item of section.items) {
        expect(getCatalogueItem(item.id)).toBe(item);
      }
    }
  });

  it("starts the player on the canonical Sunstruck Synapse audio fixture", () => {
    expect(initialCatalogueItem).toBe(getCatalogueItem("solar-nerve"));
    expect(initialCatalogueItem.mediaKind).toBe("audio");
    expect(initialCatalogueItem.media).toEqual({
      src: "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
      mimeType: "audio/mpeg",
    });
  });

  it("exposes the radio structure without service or portfolio language", () => {
    expect(catalogueSections.map((section) => section.title)).toEqual([
      "Latest transmissions",
      "Listen",
      "Watch",
    ]);
    expect(JSON.stringify(catalogueSections)).not.toMatch(/portfolio|client work|service/i);
  });

  it("fails loudly for an unknown fixture identifier", () => {
    expect(() => getCatalogueItem("missing-item")).toThrow(
      "Unknown catalogue fixture: missing-item",
    );
  });

  it("maps both supplied audio files and all three supplied video files", () => {
    expect(
      catalogueItems
        .filter((item) => item.mediaKind === "audio" && item.media)
        .map((item) => item.media?.src),
    ).toEqual([
      "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
      "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3",
    ]);
    expect(
      catalogueItems
        .filter((item) => item.mediaKind === "video" && item.media)
        .map((item) => item.media?.src),
    ).toEqual([
      "/assets/video/AI_pop-slop_202607190035.mp4",
      "/assets/video/final-movie_00007_.mp4",
      "/assets/video/gone_fishing.mp4",
    ]);
  });
});
