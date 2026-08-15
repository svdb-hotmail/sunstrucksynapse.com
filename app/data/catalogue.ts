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
      title: "Signal Bloom",
      subtitle: "A luminous visual transmission shaped around rhythm and motion.",
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
      title: "Solar Nerve",
      subtitle: "A bright, restless transmission built for close listening.",
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
      title: "Neon Weather",
      subtitle: "Synthetic weather patterns moving through colour and light.",
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
      title: "Morning Voltage",
      subtitle: "Early light, charged textures and a steady forward pulse.",
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
      title: "Synapse Drift",
      subtitle: "A slow visual drift through the station's imagined signal path.",
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
