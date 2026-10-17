import type { CatalogueItem, PublicEditorialCollection } from "~/types/catalogue";

export function listeningSelection(
  items: CatalogueItem[],
  collections: PublicEditorialCollection[],
) {
  // The existing Listen collection defines station order; other collections are explicit listening paths.
  const collection = collections.find(
    (entry) =>
      entry.slug === "listen" &&
      entry.items.some((item) => item.mediaKind === "audio" && item.media),
  );
  const tracks = (collection?.items ?? items).filter(
    (item) => item.mediaKind === "audio" && item.media,
  );
  return { collection, tracks: [...new Map(tracks.map((track) => [track.id, track])).values()] };
}

export function trackDuration(durationMs?: number): string | null {
  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
