import type { CatalogueItem, CatalogueSection, QueueEntry } from "~/types/catalogue";

const creator = {
  id: "listener-artist",
  slug: "sunstruck-synapse",
  name: "Sunstruck Synapse",
  role: "Artist",
  href: "/artists/sunstruck-synapse",
};

const release = {
  id: "listener-release",
  slug: "phase-zero-transmissions",
  title: "Phase Zero Transmissions",
  href: "/releases/phase-zero-transmissions",
};

const common = { creator, release };

export const listenerItems: CatalogueItem[] = [
  {
    ...common,
    id: "listener-revolution",
    slug: "revolution-will-be-televised",
    href: "/tracks/phase-zero-transmissions/revolution-will-be-televised",
    artwork: { src: "/assets/thumbs/thumb-02.svg", alt: "Revolution Will Be Televised artwork" },
    description: {
      title: "Revolution Will Be Televised",
      subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
    },
    mediaKind: "audio",
    media: {
      src: "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
      mimeType: "audio/mpeg",
    },
  },
  {
    ...common,
    id: "listener-mushroom-circle",
    slug: "the-mushroom-circle",
    href: "/tracks/phase-zero-transmissions/the-mushroom-circle",
    artwork: { src: "/assets/thumbs/thumb-05.svg", alt: "The Mushroom Circle artwork" },
    description: {
      title: "The Mushroom Circle",
      subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
    },
    mediaKind: "audio",
    media: {
      src: "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3",
      mimeType: "audio/mpeg",
    },
  },
  {
    ...common,
    id: "listener-final-movie",
    slug: "final-movie-00007",
    href: "/tracks/phase-zero-transmissions/final-movie-00007",
    artwork: { src: "/assets/thumbs/thumb-03.svg", alt: "Final Movie 00007 artwork" },
    description: {
      title: "Final Movie 00007",
      subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
    },
    mediaKind: "video",
    media: {
      src: "/assets/video/final-movie_00007_.mp4",
      mimeType: "video/mp4",
    },
  },
  {
    ...common,
    id: "listener-gone-fishing",
    slug: "gone-fishing",
    href: "/tracks/phase-zero-transmissions/gone-fishing",
    artwork: { src: "/assets/thumbs/thumb-09.svg", alt: "Gone Fishing artwork" },
    description: {
      title: "Gone Fishing",
      subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
    },
    mediaKind: "video",
    media: {
      src: "/assets/video/gone_fishing.mp4",
      mimeType: "video/mp4",
    },
  },
  {
    ...common,
    id: "listener-pop-slop",
    slug: "ai-pop-slop-202607190035",
    href: "/tracks/phase-zero-transmissions/ai-pop-slop-202607190035",
    artwork: { src: "/assets/thumbs/thumb-01.svg", alt: "AI Pop-Slop artwork" },
    description: {
      title: "AI Pop-Slop 202607190035",
      subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
    },
    mediaKind: "video",
    media: {
      src: "/assets/video/AI_pop-slop_202607190035.mp4",
      mimeType: "video/mp4",
    },
  },
  {
    ...common,
    id: "listener-quiet-machines",
    slug: "quiet-machines",
    href: "/tracks/phase-zero-transmissions/quiet-machines",
    artwork: { src: "/assets/thumbs/thumb-06.svg", alt: "Quiet Machines artwork" },
    description: {
      title: "Quiet Machines",
      subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
    },
    mediaKind: "audio",
  },
];

export const listenerSections: CatalogueSection[] = [
  {
    id: "latest",
    title: "Latest transmissions",
    icon: "✦",
    href: "/collections/latest-transmissions",
    items: listenerItems.slice(0, 4),
  },
  {
    id: "audio",
    title: "Listen",
    icon: "✺",
    href: "/collections/listen",
    items: listenerItems.filter((item) => item.mediaKind === "audio"),
  },
  {
    id: "video",
    title: "Watch",
    icon: "✹",
    href: "/collections/watch",
    items: listenerItems.filter((item) => item.mediaKind === "video"),
  },
];

export const initialListenerQueue: QueueEntry[] = [
  {
    itemId: listenerItems[1]!.id,
    title: listenerItems[1]!.description.title,
    subtitle: listenerItems[1]!.description.subtitle,
  },
];
