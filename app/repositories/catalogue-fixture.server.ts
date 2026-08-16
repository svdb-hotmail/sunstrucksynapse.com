import { createStaticCatalogueRepository } from "~/repositories/catalogue.server";
import type { CatalogueItem, MediaKind } from "~/types/catalogue";

const artist = {
  id: "10000000-0000-4000-8000-000000000101",
  slug: "sunstruck-synapse",
  name: "Sunstruck Synapse",
  role: "Artist",
  href: "/artists/sunstruck-synapse",
};

const release = {
  id: "20000000-0000-4000-8000-000000000101",
  slug: "phase-zero-transmissions",
  title: "Phase Zero Transmissions",
  href: "/releases/phase-zero-transmissions",
};

function item(
  index: number,
  slug: string,
  title: string,
  mediaKind: MediaKind,
  mediaSrc: string | null,
  mimeType: string | null,
  artworkSrc: string,
): CatalogueItem {
  const base = {
    id: `30000000-0000-4000-8000-${String(100 + index).padStart(12, "0")}`,
    slug,
    creator: artist,
    release,
    href: `/tracks/${release.slug}/${slug}`,
    artwork: {
      src: artworkSrc,
      alt: `${title} artwork.`,
    },
    description: {
      title,
      subtitle: `${release.title} · ${artist.name}`,
    },
  };

  return mediaKind === "audio"
    ? {
        ...base,
        mediaKind,
        media:
          mediaSrc && mimeType
            ? { src: mediaSrc, mimeType: mimeType as `audio/${string}` }
            : undefined,
      }
    : {
        ...base,
        mediaKind,
        media:
          mediaSrc && mimeType
            ? { src: mediaSrc, mimeType: mimeType as `video/${string}` }
            : undefined,
      };
}

const items = [
  item(
    1,
    "ai-pop-slop-202607190035",
    "AI Pop-Slop 202607190035",
    "video",
    "/assets/video/AI_pop-slop_202607190035.mp4",
    "video/mp4",
    "/assets/thumbs/thumb-01.svg",
  ),
  item(
    2,
    "revolution-will-be-televised",
    "Sunstruck Synapse (Revolution will be televised)",
    "audio",
    "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
    "audio/mpeg",
    "/assets/thumbs/thumb-02.svg",
  ),
  item(
    3,
    "final-movie-00007",
    "Final Movie 00007",
    "video",
    "/assets/video/final-movie_00007_.mp4",
    "video/mp4",
    "/assets/thumbs/thumb-03.svg",
  ),
  item(
    4,
    "the-mushroom-circle-gnome-revolution",
    "The Mushroom Circle (Gnome Revolution)",
    "audio",
    "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3",
    "audio/mpeg",
    "/assets/thumbs/thumb-05.svg",
  ),
  item(
    5,
    "gone-fishing",
    "Gone Fishing",
    "video",
    "/assets/video/gone_fishing.mp4",
    "video/mp4",
    "/assets/thumbs/thumb-09.svg",
  ),
  item(6, "quiet-machines", "Quiet Machines", "audio", null, null, "/assets/thumbs/thumb-06.svg"),
];

export function createE2eCatalogueRepository() {
  return createStaticCatalogueRepository(items, [
    {
      id: "60000000-0000-4000-8000-000000000101",
      slug: "latest-transmissions",
      name: "Latest transmissions",
      description: "The newest published transmissions selected for the radio.",
      items: items.slice(0, 4),
    },
    {
      id: "60000000-0000-4000-8000-000000000102",
      slug: "listen",
      name: "Listen",
      description: "Published audio transmissions.",
      items: items.filter((entry) => entry.mediaKind === "audio"),
    },
    {
      id: "60000000-0000-4000-8000-000000000103",
      slug: "watch",
      name: "Watch",
      description: "Published audiovisual transmissions.",
      items: items.filter((entry) => entry.mediaKind === "video"),
    },
  ]);
}
