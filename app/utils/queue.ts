import type { CatalogueItem, PlaybackOrigin, QueueEntry } from "~/types/catalogue";

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

/** Preserve the release query's order; never use the global catalogue as an album. */
export function albumQueue(tracks: CatalogueItem[]): QueueEntry[] {
  return tracks.reduce<QueueEntry[]>((entries, item) => {
    const next = addQueueItem(entries, item);
    return next === entries
      ? entries
      : next.map((entry) =>
          entry.itemId === item.id ? { ...entry, albumId: item.release.id } : entry,
        );
  }, []);
}

/** Re-queueing an album moves its complete ordered block to the end. */
export function appendAlbumQueue(current: QueueEntry[], tracks: CatalogueItem[]): QueueEntry[] {
  const album = albumQueue(tracks);
  const ids = new Set(album.map((entry) => entry.itemId));
  return [...current.filter((entry) => !ids.has(entry.itemId)), ...album];
}

/** Keep played history and the listener's actual upcoming order in one finite scope. */
export function reconcilePlaybackScope(
  scope: string[] | null,
  currentItemId: string | null,
  entries: QueueEntry[],
): string[] | null {
  if (!scope || !currentItemId) return scope;
  const currentIndex = scope.indexOf(currentItemId);
  if (currentIndex < 0) return scope;
  const pending = new Set(entries.map((entry) => entry.itemId));
  return [
    ...scope.slice(0, currentIndex).filter((id) => !pending.has(id)),
    currentItemId,
    ...entries.filter((entry) => entry.itemId !== currentItemId).map((entry) => entry.itemId),
  ];
}

/** Rebuilding Previous must retain the source of consumed as well as queued tracks. */
export function scopedQueue(tracks: CatalogueItem[], origin?: PlaybackOrigin): QueueEntry[] {
  return tracks.reduce<QueueEntry[]>((entries, track) => {
    const next = addQueueItem(entries, track, origin?.collectionId);
    return next.map((entry) =>
      entry.itemId === track.id
        ? {
            ...entry,
            ...(origin?.selectionId ? { selectionId: origin.selectionId } : {}),
            ...(origin?.albumId === track.release.id ? { albumId: origin.albumId } : {}),
          }
        : entry,
    );
  }, []);
}

/** Enter an album using the listener's surviving queue, preserving edits to an active scope. */
export function queuedPlaybackScope(
  entries: QueueEntry[],
  selected: QueueEntry,
  currentScope: string[] | null,
  currentItemId?: string | null,
): string[] | null {
  if (currentScope && currentItemId)
    return reconcilePlaybackScope(currentScope, currentItemId, [
      selected,
      ...entries.filter((entry) => entry.itemId !== selected.itemId),
    ]);
  if (currentScope)
    return currentScope.includes(selected.itemId)
      ? currentScope
      : [...currentScope, selected.itemId];
  if (!selected.albumId && !selected.selectionId) return null;
  return [
    selected.itemId,
    ...entries
      .filter(
        (entry) =>
          entry.itemId !== selected.itemId &&
          (selected.selectionId
            ? entry.selectionId === selected.selectionId
            : entry.albumId === selected.albumId),
      )
      .map((entry) => entry.itemId),
  ];
}
