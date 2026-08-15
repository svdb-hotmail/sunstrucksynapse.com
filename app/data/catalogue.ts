import type {
  CatalogueItem,
  CatalogueSection,
  Creator,
  Offering,
  QueueEntry,
} from "~/types/catalogue";

// Temporary presentation fixtures pending the persistent catalogue work in #12.
const sunstruckSynapse: Creator = {
  id: "sunstruck-synapse",
  name: "Sunstruck Synapse",
  role: "Creative studio",
};

export const catalogueItems: CatalogueItem[] = [
  {
    id: "signal-bloom",
    creator: sunstruckSynapse,
    mediaKind: "video",
    artwork: {
      src: "/assets/thumbs/thumb-01.svg",
      alt: "Signal Bloom project thumbnail",
    },
    description: {
      title: "Signal Bloom",
      subtitle: "Audio visual concept reel",
    },
  },
  {
    id: "solar-nerve",
    creator: sunstruckSynapse,
    mediaKind: "audio",
    artwork: {
      src: "/assets/thumbs/thumb-02.svg",
      playerSrc: "/assets/hero-art.svg",
      alt: "Solar Nerve project artwork",
    },
    description: {
      title: "Solar Nerve",
      subtitle: "Music direction study",
    },
  },
  {
    id: "neon-weather",
    creator: sunstruckSynapse,
    mediaKind: "video",
    artwork: {
      src: "/assets/thumbs/thumb-03.svg",
      alt: "Neon Weather project thumbnail",
    },
    description: {
      title: "Neon Weather",
      subtitle: "AI video prompt system",
    },
  },
  {
    id: "memory-static",
    creator: sunstruckSynapse,
    mediaKind: "audio",
    artwork: {
      src: "/assets/thumbs/thumb-04.svg",
      alt: "Memory Static project thumbnail",
    },
    description: {
      title: "Memory Static",
      subtitle: "Spoken-word atmosphere",
    },
  },
  {
    id: "morning-voltage",
    creator: sunstruckSynapse,
    mediaKind: "audio",
    artwork: {
      src: "/assets/thumbs/thumb-05.svg",
      alt: "Morning Voltage audio thumbnail",
    },
    description: {
      title: "Morning Voltage",
      subtitle: "Sonic identity package",
    },
  },
  {
    id: "quiet-machines",
    creator: sunstruckSynapse,
    mediaKind: "audio",
    artwork: {
      src: "/assets/thumbs/thumb-06.svg",
      alt: "Quiet Machines audio thumbnail",
    },
    description: {
      title: "Quiet Machines",
      subtitle: "Ambient concept work",
    },
  },
  {
    id: "sunlit-debris",
    creator: sunstruckSynapse,
    mediaKind: "audio",
    artwork: {
      src: "/assets/thumbs/thumb-07.svg",
      alt: "Sunlit Debris audio thumbnail",
    },
    description: {
      title: "Sunlit Debris",
      subtitle: "Spoken-word track world",
    },
  },
  {
    id: "glass-orchard",
    creator: sunstruckSynapse,
    mediaKind: "audio",
    artwork: {
      src: "/assets/thumbs/thumb-08.svg",
      alt: "Glass Orchard audio thumbnail",
    },
    description: {
      title: "Glass Orchard",
      subtitle: "Release moodboard",
    },
  },
  {
    id: "synapse-drift",
    creator: sunstruckSynapse,
    mediaKind: "video",
    artwork: {
      src: "/assets/thumbs/thumb-09.svg",
      alt: "Synapse Drift video thumbnail",
    },
    description: {
      title: "Synapse Drift",
      subtitle: "Keyframe video experiment",
    },
  },
  {
    id: "soft-collision",
    creator: sunstruckSynapse,
    mediaKind: "video",
    artwork: {
      src: "/assets/thumbs/thumb-10.svg",
      alt: "Soft Collision video thumbnail",
    },
    description: {
      title: "Soft Collision",
      subtitle: "Music video treatment",
    },
  },
  {
    id: "infrared-room",
    creator: sunstruckSynapse,
    mediaKind: "video",
    artwork: {
      src: "/assets/thumbs/thumb-11.svg",
      alt: "Infrared Room video thumbnail",
    },
    description: {
      title: "Infrared Room",
      subtitle: "Visual loop direction",
    },
  },
  {
    id: "horizon-teeth",
    creator: sunstruckSynapse,
    mediaKind: "video",
    artwork: {
      src: "/assets/thumbs/thumb-12.svg",
      alt: "Horizon Teeth video thumbnail",
    },
    description: {
      title: "Horizon Teeth",
      subtitle: "Cinematic AI reel",
    },
  },
];

const itemsById = new Map(catalogueItems.map((item) => [item.id, item]));

export function getCatalogueItem(id: string): CatalogueItem {
  const item = itemsById.get(id);
  if (!item) {
    throw new Error(`Unknown catalogue fixture: ${id}`);
  }
  return item;
}

export const initialCatalogueItem = getCatalogueItem("solar-nerve");

export const catalogueSections: CatalogueSection[] = [
  {
    id: "latest",
    title: "Latest uploads",
    icon: "\u2726",
    items: [
      getCatalogueItem("signal-bloom"),
      getCatalogueItem("solar-nerve"),
      getCatalogueItem("neon-weather"),
      getCatalogueItem("memory-static"),
    ],
  },
  {
    id: "audio",
    title: "Audio portfolio",
    icon: "\u273a",
    items: [
      getCatalogueItem("morning-voltage"),
      getCatalogueItem("quiet-machines"),
      getCatalogueItem("sunlit-debris"),
      getCatalogueItem("glass-orchard"),
    ],
  },
  {
    id: "video",
    title: "Video portfolio",
    icon: "\u2739",
    items: [
      getCatalogueItem("synapse-drift"),
      getCatalogueItem("soft-collision"),
      getCatalogueItem("infrared-room"),
      getCatalogueItem("horizon-teeth"),
    ],
  },
];

export const initialQueue: QueueEntry[] = [
  { id: "queue-1", itemId: "solar-nerve", title: "Solar Nerve", subtitle: "AI video teaser" },
  { id: "queue-2", itemId: "neon-weather", title: "Neon Weather", subtitle: "Audio identity" },
  { id: "queue-3", itemId: "memory-static", title: "Memory Static", subtitle: "Portfolio cut" },
  { id: "queue-4", itemId: "synapse-drift", title: "Synapse Drift", subtitle: "Visual loop" },
  { id: "queue-5", itemId: "morning-voltage", title: "Morning Voltage", subtitle: "Music concept" },
];

export const offerings: Offering[] = [
  {
    id: "audio-identity",
    number: "01",
    title: "Audio Identity",
    description:
      "Sound palette, music references, spoken-word direction, track concepting, and release framing.",
  },
  {
    id: "video-direction",
    number: "02",
    title: "Video Direction",
    description:
      "Shot lists, prompts, scene logic, keyframe planning, and AI-video continuity systems.",
  },
  {
    id: "media-portfolio",
    number: "03",
    title: "Media Portfolio",
    description:
      "A browser-ready portfolio experience for audio, video, visuals, and client case studies.",
  },
  {
    id: "creative-systems",
    number: "04",
    title: "Creative Systems",
    description:
      "Repeatable workflows for prompts, assets, tooling, delivery, and production documentation.",
  },
];
