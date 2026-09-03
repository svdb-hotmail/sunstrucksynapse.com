import type { Meta, StoryObj } from "@storybook/react-vite";

import { CatalogueSection } from "~/components/CatalogueSection";
import type { CatalogueItem, CatalogueSection as CatalogueSectionModel } from "~/types/catalogue";

const items: CatalogueItem[] = [
  {
    id: "story-section-audio",
    slug: "signal-in-bloom",
    creator: {
      id: "story-artist",
      slug: "sunstruck-synapse",
      name: "Sunstruck Synapse",
      role: "Artist",
      href: "/artists/sunstruck-synapse",
    },
    release: {
      id: "story-release",
      slug: "phase-zero-transmissions",
      title: "Phase Zero Transmissions",
      href: "/releases/phase-zero-transmissions",
    },
    href: "/tracks/phase-zero-transmissions/signal-in-bloom",
    artwork: { src: "/assets/thumbs/thumb-02.svg", alt: "Signal in Bloom artwork" },
    description: {
      title: "Signal in Bloom",
      subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
    },
    mediaKind: "audio",
    media: {
      src: "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
      mimeType: "audio/mpeg",
    },
  },
  {
    id: "story-section-video",
    slug: "final-movie-00007",
    creator: {
      id: "story-artist",
      slug: "sunstruck-synapse",
      name: "Sunstruck Synapse",
      role: "Artist",
      href: "/artists/sunstruck-synapse",
    },
    release: {
      id: "story-release",
      slug: "phase-zero-transmissions",
      title: "Phase Zero Transmissions",
      href: "/releases/phase-zero-transmissions",
    },
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
    id: "story-section-unavailable",
    slug: "quiet-machines",
    creator: {
      id: "story-artist",
      slug: "sunstruck-synapse",
      name: "Sunstruck Synapse",
      role: "Artist",
      href: "/artists/sunstruck-synapse",
    },
    release: {
      id: "story-release",
      slug: "phase-zero-transmissions",
      title: "Phase Zero Transmissions",
      href: "/releases/phase-zero-transmissions",
    },
    href: "/tracks/phase-zero-transmissions/quiet-machines",
    artwork: { src: "/assets/thumbs/thumb-06.svg", alt: "Quiet Machines artwork" },
    description: {
      title: "Quiet Machines",
      subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
    },
    mediaKind: "audio",
    media: undefined,
  },
];

const section: CatalogueSectionModel = {
  id: "latest",
  title: "Latest transmissions",
  icon: "✦",
  href: "/collections/latest-transmissions",
  items,
};

const meta = {
  title: "Production/CatalogueSection",
  component: CatalogueSection,
  tags: ["autodocs"],
  args: {
    section,
    selectedItemId: null,
    onSelect: () => undefined,
    onQueue: () => undefined,
    onPlay: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        component:
          "A production transmission section showing a mixed row of playable and unavailable catalogue cards.",
      },
    },
  },
} satisfies Meta<typeof CatalogueSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedAvailability: Story = {};

export const SelectedTransmission: Story = {
  args: { selectedItemId: "story-section-audio" },
};

export const LightTheme: Story = {
  globals: { theme: "light" },
};
