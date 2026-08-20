import { describe, expect, it } from "vitest";

import type { CatalogueItem } from "../../app/types/catalogue";
import {
  addQueueItem,
  findAdjacentPlayableItem,
  findNextPlayableQueueEntry,
  removeQueueItem,
} from "../../app/utils/queue";
import { makeCatalogueItem } from "../fixtures/catalogue";

describe("queue operations", () => {
  it("adds unique items in insertion order", () => {
    const solarNerve = makeCatalogueItem("solar-nerve");
    const neonWeather = makeCatalogueItem("neon-weather", { mediaKind: "video" });

    const first = addQueueItem([], solarNerve);
    const duplicate = addQueueItem(first, solarNerve);
    const second = addQueueItem(duplicate, neonWeather);

    expect(duplicate).toBe(first);
    expect(second.map((entry) => entry.itemId)).toEqual(["solar-nerve", "neon-weather"]);
  });

  it("rejects unavailable items", () => {
    const entries = addQueueItem([], makeCatalogueItem("quiet-machines", { media: false }));

    expect(entries).toEqual([]);
  });

  it("stores collection attribution on queued entries", () => {
    const item = makeCatalogueItem("solar-nerve");

    const entries = addQueueItem([], item, "collection-123");

    expect(entries[0]).toMatchObject({
      itemId: item.id,
      collectionId: "collection-123",
    });
  });

  it("removes only the selected queue item", () => {
    const entries = [
      ...addQueueItem([], makeCatalogueItem("solar-nerve")),
      ...addQueueItem([], makeCatalogueItem("neon-weather")),
    ];

    expect(removeQueueItem(entries, "solar-nerve").map((entry) => entry.itemId)).toEqual([
      "neon-weather",
    ]);
  });

  it("finds the first playable item without disturbing queue order", () => {
    const unavailable = makeCatalogueItem("quiet-machines", { media: false });
    const videoItem = makeCatalogueItem("neon-weather", { mediaKind: "video" });
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
    const unavailableEntry = {
      itemId: unavailable.id,
      title: unavailable.description.title,
      subtitle: unavailable.description.subtitle,
    };
    const entries = [unavailableEntry, ...addQueueItem([], playable)];
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
    expect(entries.map((entry) => entry.itemId)).toEqual(["quiet-machines", "neon-weather"]);
  });

  it("finds previous and next playable catalogue items without wrapping", () => {
    const first = makeCatalogueItem("first");
    const unavailable = makeCatalogueItem("unavailable", { media: false });
    const third = makeCatalogueItem("third");
    const items = [first, unavailable, third];

    expect(findAdjacentPlayableItem(items, first.id, 1)).toBe(third);
    expect(findAdjacentPlayableItem(items, third.id, -1)).toBe(first);
    expect(findAdjacentPlayableItem(items, first.id, -1)).toBeUndefined();
    expect(findAdjacentPlayableItem(items, third.id, 1)).toBeUndefined();
  });
});
