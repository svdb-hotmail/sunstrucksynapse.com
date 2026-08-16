import { describe, expect, it } from "vitest";

import { restorePlayerState, serializePlayerState } from "../../app/utils/player-storage";
import { addQueueItem } from "../../app/utils/queue";
import { makeCatalogueItem } from "../fixtures/catalogue";

describe("player persistence", () => {
  const first = makeCatalogueItem("first");
  const second = makeCatalogueItem("second");
  const unavailable = makeCatalogueItem("unavailable", { media: false });
  const items = [first, second, unavailable];

  it("restores the selected track and playable queue in order", () => {
    const queue = addQueueItem(addQueueItem([], second), first);
    const stored = serializePlayerState(second.id, queue);

    expect(restorePlayerState(stored, items, first.id)).toEqual({
      selectedItemId: second.id,
      queue,
    });
  });

  it("does not restore unknown, unavailable or duplicate queue entries", () => {
    const stored = JSON.stringify({
      version: 1,
      selectedItemId: "missing",
      queueItemIds: [second.id, unavailable.id, second.id, "missing"],
    });

    expect(restorePlayerState(stored, items, first.id)).toEqual({
      selectedItemId: first.id,
      queue: addQueueItem([], second),
    });
  });

  it("falls back safely for invalid storage", () => {
    expect(restorePlayerState("{invalid", items, first.id)).toEqual({
      selectedItemId: first.id,
      queue: [],
    });
  });
});
