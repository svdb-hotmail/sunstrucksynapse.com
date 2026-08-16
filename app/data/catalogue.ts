import type { CatalogueItem, CatalogueSection, Creator, Offering } from "~/types/catalogue";

// Temporary presentation fixtures pending the persistent catalogue work in #12.
const sunstruckSynapse: Creator = {
  id: "sunstruck-synapse",
  name: "Sunstruck Synapse",
  role: "Human curator",
};

export const catalogueItems: CatalogueItem[] = [
  {
    id: "signal-bloom",
    creator: sunstruckSynapse,
    mediaKind: "video",
    artwork: {
      src: "/assets/thumbs/thumb-01.svg",
      alt: "Signal Bloom visual artwork",
    },
    description: {
      title: "AI Pop-Slop 202607190035",
      subtitle: "A bright visual transmission moving through synthetic pop imagery.",
    },
    media: {
      src: "/assets/video/AI_pop-slop_202607190035.mp4",
      mimeType: "video/mp4",
    },
  },
  {
    id: "solar-nerve",
    creator: sunstruckSynapse,
    mediaKind: "audio",
    artwork: {
      src: "/assets/thumbs/thumb-02.svg",
      playerSrc: "/assets/hero-art.svg",
      alt: "Solar Nerve cover artwork",
    },
    description: {
      title: "Sunstruck Synapse (Revolution will be televised)",
      subtitle: "A restless broadcast built around momentum, signal and revolt.",
    },
    media: {
      src: "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
      mimeType: "audio/mpeg",
    },
  },
  {
    id: "neon-weather",
    creator: sunstruckSynapse,
    mediaKind: "video",
    artwork: {
      src: "/assets/thumbs/thumb-03.svg",
      alt: "Neon Weather visual artwork",
    },
    description: {
      title: "Final Movie 00007",
      subtitle: "A compact visual transmission shaped by light, motion and atmosphere.",
    },
    media: {
      src: "/assets/video/final-movie_00007_.mp4",
      mimeType: "video/mp4",
    },
  },
  {
    id: "memory-static",
    creator: sunstruckSynapse,
    mediaKind: "audio",
    artwork: {
      src: "/assets/thumbs/thumb-04.svg",
      alt: "Memory Static cover artwork",
    },
    description: {
      title: "Memory Static",
      subtitle: "Spoken fragments suspended in a slow electronic atmosphere.",
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
      title: "The Mushroom Circle (Gnome Revolution)",
      subtitle: "A playful, charged gathering with a revolutionary pulse.",
    },
    media: {
      src: "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3",
      mimeType: "audio/mpeg",
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
      subtitle: "An ambient transmission for the spaces between machines.",
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
      subtitle: "Voice, dust and melody drifting through a sunlit signal.",
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
      subtitle: "Glass-bright tones growing into an unfamiliar landscape.",
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
      title: "Gone Fishing",
      subtitle: "A quiet visual excursion beyond the usual signal path.",
    },
    media: {
      src: "/assets/video/gone_fishing.mp4",
      mimeType: "video/mp4",
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
      subtitle: "Soft forms collide in a visual counterpart to the music.",
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
      subtitle: "A contained visual loop glowing beyond the visible spectrum.",
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
      subtitle: "A cinematic transmission balancing unease, scale and stillness.",
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
    title: "Latest transmissions",
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
    title: "Listen",
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
    title: "Watch",
    icon: "\u2739",
    items: [
      getCatalogueItem("synapse-drift"),
      getCatalogueItem("soft-collision"),
      getCatalogueItem("infrared-room"),
      getCatalogueItem("horizon-teeth"),
    ],
  },
];

export const offerings: Offering[] = [
  {
    id: "human-curation",
    number: "01",
    title: "Human curation",
    description:
      "Every transmission is selected and sequenced by people, with taste and context leading the signal.",
  },
  {
    id: "ai-instrument",
    number: "02",
    title: "AI as an instrument",
    description:
      "AI-assisted tools can shape sound and image, but they remain instruments in a directed process.",
  },
  {
    id: "intentional-authorship",
    number: "03",
    title: "Intentional authorship",
    description:
      "Direction, decisions and responsibility stay with the people making and presenting the work.",
  },
  {
    id: "listening-first",
    number: "04",
    title: "Listening first",
    description:
      "The radio is designed around attentive listening and the visual counterparts that deepen it.",
  },
];
