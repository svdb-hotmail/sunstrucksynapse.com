import { describe, expect, it } from "vitest";

import { discoveryOptions, filterCatalogue } from "../../app/services/discovery";
import { makeCatalogueItem } from "../fixtures/catalogue";

const ambient = {
  ...makeCatalogueItem("quiet-circuit"),
  discovery: {
    genre: "ambient",
    moods: ["calm", "reflective"],
    year: 2025,
    creativeProcessTags: ["human-performance", "ai-texture"],
  },
};
const folk = {
  ...makeCatalogueItem("mushroom-circle"),
  creator: { ...makeCatalogueItem("mushroom-circle").creator, name: "Forest Assembly" },
  discovery: {
    genre: "folk",
    moods: ["earthy"],
    year: 2024,
    creativeProcessTags: ["human-performance"],
  },
};
const items = [ambient, folk];

describe("catalogue discovery", () => {
  it("combines text and structured filters", () => {
    expect(
      filterCatalogue(items, {
        query: "quiet",
        genre: "ambient",
        mood: "calm",
        year: 2025,
        process: "ai-texture",
      }),
    ).toEqual([ambient]);
    expect(
      filterCatalogue(items, {
        query: "forest",
        genre: "",
        mood: "",
        year: null,
        process: "",
      }),
    ).toEqual([folk]);
  });

  it("returns empty results when any active filter does not match", () => {
    expect(
      filterCatalogue(items, {
        query: "",
        genre: "folk",
        mood: "calm",
        year: null,
        process: "",
      }),
    ).toEqual([]);
  });

  it("deduplicates and sorts available filter options", () => {
    expect(discoveryOptions(items)).toEqual({
      genres: ["ambient", "folk"],
      moods: ["calm", "earthy", "reflective"],
      years: [2025, 2024],
      processes: ["ai-texture", "human-performance"],
    });
  });
});
