import type {
  PublicArtist,
  PublicEditorialCollection,
  PublicRelease,
  PublicTrack,
} from "~/types/catalogue";

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: Readonly<Record<string, unknown>>;
}

export function artistSeo(artist: PublicArtist): SeoMetadata {
  return {
    title: `${artist.name} | Sunstruck Synapse Radio`,
    description: artist.biography ?? `Listen to published music by ${artist.name}.`,
    canonicalPath: artist.href,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      name: artist.name,
      url: artist.href,
    },
  };
}

export function releaseSeo(release: PublicRelease): SeoMetadata {
  return {
    title: `${release.title} | Sunstruck Synapse Radio`,
    description: `Listen to ${release.title} by ${release.artists.map(({ name }) => name).join(", ")}.`,
    canonicalPath: release.href,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "MusicAlbum",
      name: release.title,
      datePublished: release.releaseDate,
      byArtist: release.artists.map(({ name }) => ({ "@type": "MusicGroup", name })),
    },
  };
}

export function trackSeo(track: PublicTrack): SeoMetadata {
  return {
    title: `${track.item.description.title} | Sunstruck Synapse Radio`,
    description: `Listen to ${track.item.description.title} by ${track.artist.name}.`,
    canonicalPath: track.item.href,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "MusicRecording",
      name: track.item.description.title,
      byArtist: { "@type": "MusicGroup", name: track.artist.name },
      inAlbum: { "@type": "MusicAlbum", name: track.release.title },
    },
  };
}

export function collectionSeo(collection: PublicEditorialCollection): SeoMetadata {
  return {
    title: `${collection.name} | Sunstruck Synapse Radio`,
    description: collection.description ?? `A curated selection from Sunstruck Synapse Radio.`,
    canonicalPath: `/collections/${collection.slug}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: collection.name,
      itemListElement: collection.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.description.title,
        url: item.href,
      })),
    },
  };
}
