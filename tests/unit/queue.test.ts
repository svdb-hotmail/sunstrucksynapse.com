import { describe, expect, it } from "vitest";

import { getCatalogueItem } from "../../app/data/catalogue";
import type { CatalogueItem } from "../../app/types/catalogue";
import { addQueueItem, findNextPlayableQueueEntry, removeQueueItem } from "../../app/utils/queue";

describe("queue operations", () => {
  it("adds unique items in insertion order", () => {
    const solarNerve = getCatalogueItem("solar-nerve");
    const neonWeather = getCatalogueItem("neon-weather");

    const first = addQueueItem([], solarNerve);
    const duplicate = addQueueItem(first, solarNerve);
    const second = addQueueItem(duplicate, neonWeather);

    expect(duplicate).toBe(first);
    expect(second.map((entry) => entry.itemId)).toEqual(["solar-nerve", "neon-weather"]);
  });

  it("removes only the selected queue item", () => {
    const entries = [
      ...addQueueItem([], getCatalogueItem("solar-nerve")),
      ...addQueueItem([], getCatalogueItem("neon-weather")),
    ];

    expect(removeQueueItem(entries, "solar-nerve").map((entry) => entry.itemId)).toEqual([
      "neon-weather",
    ]);
  });

  it("finds the first playable item without disturbing queue order", () => {
    const unavailable = getCatalogueItem("solar-nerve");
    const videoItem = getCatalogueItem("neon-weather");
    if (videoItem.mediaKind !== "video") {
      throw new Error("Expected Neon Weather to be a video fixture");
    }
    const playable: CatalogueItem = {
      ...videoItem,
      media: {
        src: "/assets/video/neon-weather-preview.mp4",
        mimeType: "video/mp4",
      },
    };
    const entries = addQueueItem(addQueueItem([], unavailable), playable);
    const items = new Map([
      [unavailable.id, unavailable],
      [playable.id, playable],
    ]);

    expect(
      findNextPlayableQueueEntry(entries, (itemId) => {
        const item = items.get(itemId);
        if (!item) {
          throw new Error(`Unknown test item: ${itemId}`);
        }
        return item;
      }),
    ).toEqual(entries[1]);
    expect(entries.map((entry) => entry.itemId)).toEqual(["solar-nerve", "neon-weather"]);
  });
});
