import type { CatalogueItem, QueueEntry } from "~/types/catalogue";

export function addQueueItem(entries: QueueEntry[], item: CatalogueItem): QueueEntry[] {
  if (!item.media || entries.some((entry) => entry.itemId === item.id)) {
    return entries;
  }

  return [
    ...entries,
    {
      itemId: item.id,
      title: item.description.title,
      subtitle: item.description.subtitle,
    },
  ];
}

export function removeQueueItem(entries: QueueEntry[], itemId: string): QueueEntry[] {
  return entries.filter((entry) => entry.itemId !== itemId);
}

export function findNextPlayableQueueEntry(
  entries: QueueEntry[],
  getItem: (itemId: string) => CatalogueItem,
): QueueEntry | undefined {
  return entries.find((entry) => Boolean(getItem(entry.itemId).media));
}
