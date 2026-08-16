import type { CatalogueItem, QueueEntry } from "~/types/catalogue";
import { addQueueItem } from "~/utils/queue";

export const PLAYER_STORAGE_KEY = "sunstruck-synapse-player-v1";

interface PersistedPlayer {
  version: 1;
  selectedItemId: string | null;
  queueItemIds: string[];
}

export interface RestoredPlayer {
  selectedItemId: string | null;
  queue: QueueEntry[];
}

export function serializePlayerState(selectedItemId: string | null, queue: QueueEntry[]): string {
  const value: PersistedPlayer = {
    version: 1,
    selectedItemId,
    queueItemIds: queue.map((entry) => entry.itemId),
  };
  return JSON.stringify(value);
}

export function restorePlayerState(
  storedValue: string | null,
  items: CatalogueItem[],
  defaultItemId: string | null,
): RestoredPlayer {
  if (!storedValue) {
    return { selectedItemId: defaultItemId, queue: [] };
  }

  try {
    const value: unknown = JSON.parse(storedValue);
    if (
      !value ||
      typeof value !== "object" ||
      Reflect.get(value, "version") !== 1 ||
      !Array.isArray(Reflect.get(value, "queueItemIds"))
    ) {
      return { selectedItemId: defaultItemId, queue: [] };
    }

    const itemsById = new Map(items.map((item) => [item.id, item]));
    const selectedItemId = Reflect.get(value, "selectedItemId");
    const restoredSelectedItemId =
      typeof selectedItemId === "string" && itemsById.has(selectedItemId)
        ? selectedItemId
        : defaultItemId;
    const queue = (Reflect.get(value, "queueItemIds") as unknown[]).reduce<QueueEntry[]>(
      (entries, itemId) => {
        const item = typeof itemId === "string" ? itemsById.get(itemId) : undefined;
        return item ? addQueueItem(entries, item) : entries;
      },
      [],
    );

    return { selectedItemId: restoredSelectedItemId, queue };
  } catch {
    return { selectedItemId: defaultItemId, queue: [] };
  }
}
