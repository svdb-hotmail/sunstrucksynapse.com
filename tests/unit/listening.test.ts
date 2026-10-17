import { describe, expect, it } from "vitest";
import { listeningSelection, trackDuration } from "../../app/services/listening";
import { queuedPlaybackScope, addQueueItem } from "../../app/utils/queue";
import { makeCatalogueItem } from "../fixtures/catalogue";
describe("radio selection", () => {
  it("honours the published Listen collection order and removes duplicates/unavailable media", () => {
    const a = makeCatalogueItem("a"),
      b = makeCatalogueItem("b"),
      missing = makeCatalogueItem("missing", { media: false }),
      video = makeCatalogueItem("video", { mediaKind: "video" });
    const collections = [
      { id: "video", slug: "video", name: "Watch", description: null, items: [video] },
      {
        id: "listen",
        slug: "listen",
        name: "A real selection",
        description: null,
        items: [b, missing, a, b, video],
      },
    ];
    const selected = listeningSelection([a, b, missing, video], collections);
    expect(selected.collection?.id).toBe("listen");
    expect(selected.tracks).toEqual([b, a]);
    expect(collections[1].items).toHaveLength(5);
  });
  it("keeps artist collections as explicit paths while the default radio includes all published audio", () => {
    const a = makeCatalogueItem("a"),
      b = makeCatalogueItem("b");
    const result = listeningSelection(
      [a, b],
      [{ id: "artist", slug: "artist", name: "Artist collection", description: null, items: [b] }],
    );
    expect(result.collection).toBeUndefined();
    expect(result.tracks).toEqual([a, b]);
  });
  it("uses Listen order even when a different audio collection comes first", () => {
    const a = makeCatalogueItem("a"),
      b = makeCatalogueItem("b");
    const result = listeningSelection(
      [a, b],
      [
        {
          id: "latest",
          slug: "latest-transmissions",
          name: "Latest",
          description: null,
          items: [a],
        },
        { id: "listen", slug: "listen", name: "Listen", description: null, items: [b, a] },
      ],
    );
    expect(result.collection?.id).toBe("listen");
    expect(result.tracks).toEqual([b, a]);
  });
  it("uses published audio when no collection is playable without inventing collection attribution", () => {
    const a = makeCatalogueItem("a"),
      video = makeCatalogueItem("v", { mediaKind: "video" });
    const selection = listeningSelection([video, a], []);
    expect(selection.collection).toBeUndefined();
    expect(selection.tracks).toEqual([a]);
    expect(listeningSelection([], []).tracks).toEqual([]);
  });
  it("retains an explicit cross-release selection scope through queued advancement", () => {
    const a = makeCatalogueItem("a"),
      b = makeCatalogueItem("b");
    const entries = addQueueItem([], b, "editorial");
    expect(queuedPlaybackScope(entries, entries[0], [a.id, b.id])).toEqual([a.id, b.id]);
  });
  it("formats known durations and does not invent lengths for missing or invalid values", () => {
    expect(trackDuration(295000)).toBe("4:55");
    expect(trackDuration(544000)).toBe("9:04");
    for (const n of [undefined, 0, -1, Infinity, NaN]) expect(trackDuration(n)).toBeNull();
  });
});
