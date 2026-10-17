import { describe, expect, it } from "vitest";

import type { CatalogueItem } from "../../app/types/catalogue";
import {
  addQueueItem,
  findAdjacentPlayableItem,
  findNextPlayableQueueEntry,
  removeQueueItem,
  queuedPlaybackScope,
  reconcilePlaybackScope,
  scopedQueue,
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

describe("finite listening edits", () => {
  const tracks = ["a", "b", "c", "outside"].map((id) => makeCatalogueItem(id));
  it("Play next follows queue order and Undo can restore the original scope", () => {
    const scope = ["a", "b", "c"];
    expect(reconcilePlaybackScope(scope, "a", scopedQueue([tracks[2], tracks[1]]))).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(scope).toEqual(["a", "b", "c"]);
  });
  it("moves an already-played track into the future and includes outside insertions", () => {
    expect(
      reconcilePlaybackScope(["a", "b", "c"], "b", scopedQueue([tracks[3], tracks[0], tracks[2]])),
    ).toEqual(["b", "outside", "a", "c"]);
  });
  it("selecting a later queue item rebuilds the scope around the surviving queue order", () => {
    const queue = scopedQueue([tracks[1], tracks[2]]);
    expect(queuedPlaybackScope(queue, queue[1], ["a", "b", "c"], "a")).toEqual(["a", "c", "b"]);
  });
  it("clearing the queue retains played history and a repeat of the current track adds no scope cycle", () => {
    expect(reconcilePlaybackScope(["a", "b", "c"], "b", [])).toEqual(["a", "b"]);
    expect(reconcilePlaybackScope(["a", "b"], "a", scopedQueue([tracks[0], tracks[1]]))).toEqual([
      "a",
      "b",
    ]);
    expect(reconcilePlaybackScope(null, "a", scopedQueue(tracks))).toBeNull();
  });
  it("rebuilt album and cross-release queues retain their distinct origins", () => {
    const albumOrigin = { albumId: tracks[0].release.id, selectionId: "album-session" };
    const rebuilt = scopedQueue(tracks.slice(1, 3), albumOrigin);
    expect(rebuilt.every((entry) => entry.albumId === albumOrigin.albumId)).toBe(true);
    expect(queuedPlaybackScope(rebuilt, rebuilt[0], null)).toEqual(["b", "c"]);
    const outside = { ...tracks[3], release: { ...tracks[3].release, id: "other-release" } };
    const selectionOrigin = { selectionId: "selection-session", collectionId: "cross-release" };
    const selection = scopedQueue([tracks[0], outside, tracks[2]], selectionOrigin);
    expect(selection.every((entry) => !entry.albumId)).toBe(true);
    expect(queuedPlaybackScope(selection.slice(1), selection[1], null)).toEqual(["outside", "c"]);
    expect(selection[1].collectionId).toBe("cross-release");
  });
});

import { albumQueue, appendAlbumQueue } from "../../app/utils/queue";
describe("ordered album queue", () => {
  it("keeps tracks removed before an album starts out of automatic playback scope", () => {
    const tracks = ["a", "b", "c"].map((id) => makeCatalogueItem(id));
    const surviving = removeQueueItem(albumQueue(tracks), "c");
    const scope = queuedPlaybackScope(surviving, surviving[0], null);
    expect(scope).toEqual(["a", "b"]);
    const afterFirst = removeQueueItem(surviving, "a");
    expect(queuedPlaybackScope(afterFirst, afterFirst[0], scope)).toEqual(["a", "b"]);
    expect(
      findAdjacentPlayableItem(
        tracks.filter((track) => scope?.includes(track.id)),
        "b",
        1,
      ),
    ).toBeUndefined();
  });
  it("preserves edited scope when a queued album entry is selected manually", () => {
    const entries = albumQueue(["a", "b"].map((id) => makeCatalogueItem(id)));
    const editedScope = ["a", "b"];
    expect(queuedPlaybackScope(entries, entries[1], editedScope)).toBe(editedScope);
    expect(queuedPlaybackScope(entries, entries[1], null)).toEqual(["b", "a"]);
  });
  it("uses album order even when global catalogue order differs, and excludes unavailable media", () => {
    const first = makeCatalogueItem("album-second"),
      second = makeCatalogueItem("album-first");
    const queue = albumQueue([
      first,
      makeCatalogueItem("missing", { media: false }),
      second,
      first,
    ]);
    expect(queue.map((entry) => entry.itemId)).toEqual([first.id, second.id]);
    expect(queue.every((entry) => entry.albumId === first.release.id)).toBe(true);
    expect(findAdjacentPlayableItem([first, second], second.id, 1)).toBeUndefined();
    expect(findAdjacentPlayableItem([first, second], second.id, -1)?.id).toBe(first.id);
  });
});

it("appends a complete album in order even when some album tracks were already queued", () => {
  const first = makeCatalogueItem("first"),
    second = makeCatalogueItem("second"),
    outside = makeCatalogueItem("outside");
  const existing = addQueueItem(addQueueItem([], second), outside);
  expect(appendAlbumQueue(existing, [first, second]).map((entry) => entry.itemId)).toEqual([
    outside.id,
    first.id,
    second.id,
  ]);
});
