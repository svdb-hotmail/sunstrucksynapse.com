import type { CatalogueItem, QueueEntry } from "~/types/catalogue";
import { addQueueItem } from "~/utils/queue";

export const PLAYER_STORAGE_KEY = "sunstruck-synapse-player-v1";

interface PersistedPlayer {
  version: 1;
  selectedItemId: string | null;
  queueItemIds: string[];
  playbackScope?: string[];
  queueAlbums?: Record<string, string>;
}

export interface RestoredPlayer {
  selectedItemId: string | null;
  queue: QueueEntry[];
  playbackScope?: string[];
}

export interface StorageRestoreResult {
  player: RestoredPlayer;
  persistenceAvailable: boolean;
}

export function serializePlayerState(
  selectedItemId: string | null,
  queue: QueueEntry[],
  playbackScope?: string[] | null,
): string {
  const value: PersistedPlayer = {
    version: 1,
    selectedItemId,
    queueItemIds: queue.map((entry) => entry.itemId),
    ...(playbackScope ? { playbackScope } : {}),
    ...(queue.some((entry) => entry.albumId)
      ? {
          queueAlbums: Object.fromEntries(
            queue.filter((entry) => entry.albumId).map((entry) => [entry.itemId, entry.albumId!]),
          ),
        }
      : {}),
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
        if (!item) return entries;
        const next = addQueueItem(entries, item);
        const albums = Reflect.get(value, "queueAlbums");
        const albumId = albums && typeof albums === "object" ? Reflect.get(albums, item.id) : null;
        return albumId === item.release.id
          ? next.map((entry) => (entry.itemId === item.id ? { ...entry, albumId } : entry))
          : next;
      },
      [],
    );

    const rawScope = Reflect.get(value, "playbackScope");
    const scope = Array.isArray(rawScope)
      ? [
          ...new Set(
            rawScope.filter(
              (id): id is string => typeof id === "string" && Boolean(itemsById.get(id)?.media),
            ),
          ),
        ]
      : null;
    return {
      selectedItemId: restoredSelectedItemId,
      queue,
      ...(scope?.includes(restoredSelectedItemId ?? "") ? { playbackScope: scope } : {}),
    };
  } catch {
    return { selectedItemId: defaultItemId, queue: [] };
  }
}

export function restorePlayerFromStorage(
  storage: Pick<Storage, "getItem"> | null,
  items: CatalogueItem[],
  defaultItemId: string | null,
): StorageRestoreResult {
  if (!storage) {
    return {
      player: restorePlayerState(null, items, defaultItemId),
      persistenceAvailable: false,
    };
  }

  try {
    return {
      player: restorePlayerState(storage.getItem(PLAYER_STORAGE_KEY), items, defaultItemId),
      persistenceAvailable: true,
    };
  } catch {
    return {
      player: restorePlayerState(null, items, defaultItemId),
      persistenceAvailable: false,
    };
  }
}

export function persistPlayerToStorage(
  storage: Pick<Storage, "setItem"> | null,
  selectedItemId: string | null,
  queue: QueueEntry[],
  playbackScope?: string[] | null,
): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(PLAYER_STORAGE_KEY, serializePlayerState(selectedItemId, queue, playbackScope));
    return true;
  } catch {
    return false;
  }
}
