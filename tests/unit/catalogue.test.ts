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

  it("starts the player on the canonical Solar Nerve fixture", () => {
    expect(initialCatalogueItem).toBe(getCatalogueItem("solar-nerve"));
    expect(initialCatalogueItem.mediaKind).toBe("audio");
  });

  it("fails loudly for an unknown fixture identifier", () => {
    expect(() => getCatalogueItem("missing-item")).toThrow(
      "Unknown catalogue fixture: missing-item",
    );
  });
});
