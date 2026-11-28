import type { CatalogueItem } from "~/types/catalogue";

export const FEATURED_TRACK_LIMIT = 8;

function randomFromSeed(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/** Picks a session-stable, artist-balanced set of playable audio tracks. */
export function selectFeaturedTracks(
  items: CatalogueItem[],
  seed: string,
  limit = FEATURED_TRACK_LIMIT,
): CatalogueItem[] {
  const maximum = Math.max(0, Math.floor(limit));
  if (!maximum) return [];

  const artistTracks = new Map<string, CatalogueItem[]>();
  for (const item of items) {
    if (item.mediaKind !== "audio" || !item.media) continue;
    const tracks = artistTracks.get(item.creator.id) ?? [];
    tracks.push(item);
    artistTracks.set(item.creator.id, tracks);
  }

  const random = randomFromSeed(seed);
  const pools = shuffled([...artistTracks.values()], random)
    .slice(0, maximum)
    .map((tracks) => shuffled(tracks, random));
  const selected: CatalogueItem[] = [];

  for (const pool of pools) {
    const track = pool.shift();
    if (track) selected.push(track);
  }

  while (selected.length < maximum) {
    const available = shuffled(
      pools.filter((pool) => pool.length > 0),
      random,
    );
    if (!available.length) break;
    for (const pool of available) {
      const track = pool.shift();
      if (track) selected.push(track);
      if (selected.length === maximum) break;
    }
  }

  return shuffled(selected, random);
}
