import type { CatalogueItem, QueueEntry } from "~/types/catalogue";

export function addQueueItem(
  entries: QueueEntry[],
  item: CatalogueItem,
  collectionId?: string,
): QueueEntry[] {
  if (!item.media || entries.some((entry) => entry.itemId === item.id)) {
    return entries;
  }

  const queueEntry: QueueEntry = {
    itemId: item.id,
    title: item.description.title,
    subtitle: item.description.subtitle,
  };

  if (collectionId !== undefined) {
    queueEntry.collectionId = collectionId;
  }

  return [...entries, queueEntry];
}

export function removeQueueItem(entries: QueueEntry[], itemId: string): QueueEntry[] {
  return entries.filter((entry) => entry.itemId !== itemId);
}

export function findNextPlayableQueueEntry(
  entries: QueueEntry[],
  getItem: (itemId: string) => CatalogueItem | undefined,
): QueueEntry | undefined {
  return entries.find((entry) => Boolean(getItem(entry.itemId)?.media));
}

export function findAdjacentPlayableItem(
  items: CatalogueItem[],
  currentItemId: string,
  direction: -1 | 1,
): CatalogueItem | undefined {
  const currentIndex = items.findIndex((item) => item.id === currentItemId);
  if (currentIndex < 0) {
    return undefined;
  }

  for (
    let index = currentIndex + direction;
    index >= 0 && index < items.length;
    index += direction
  ) {
    if (items[index]?.media) {
      return items[index];
    }
  }

  return undefined;
}
