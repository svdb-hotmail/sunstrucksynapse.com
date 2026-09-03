import type { Meta, StoryObj } from "@storybook/react-vite";

import { CatalogueCard } from "~/components/CatalogueCard";
import type { CatalogueItem } from "~/types/catalogue";

const playableItem: CatalogueItem = {
  id: "story-card-playable",
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
  artwork: {
    src: "/assets/thumbs/thumb-02.svg",
    alt: "Signal in Bloom artwork",
  },
  description: {
    title: "Signal in Bloom",
    subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
  },
  mediaKind: "audio",
  media: {
    src: "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
    mimeType: "audio/mpeg",
  },
};

const unavailableItem: CatalogueItem = {
  ...playableItem,
  id: "story-card-unavailable",
  slug: "quiet-machines",
  href: "/tracks/phase-zero-transmissions/quiet-machines",
  artwork: {
    src: "/assets/thumbs/thumb-06.svg",
    alt: "Quiet Machines artwork",
  },
  description: {
    title: "Quiet Machines",
    subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
  },
  media: undefined,
};

const callbacks = {
  onSelect: () => undefined,
  onQueue: () => undefined,
  onPlay: () => undefined,
};

const meta = {
  title: "Production/CatalogueCard",
  component: CatalogueCard,
  tags: ["autodocs"],
  args: {
    ...callbacks,
    isSelected: false,
  },
  parameters: {
    docs: {
      description: {
        component:
          "A production transmission card with selection, navigation, queue, playback, and unavailable-media states.",
      },
    },
  },
} satisfies Meta<typeof CatalogueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {
  args: { item: playableItem },
};

export const Selected: Story = {
  args: { item: playableItem, isSelected: true },
};

export const Unavailable: Story = {
  args: { item: unavailableItem },
};

export const LightTheme: Story = {
  args: { item: playableItem },
  globals: { theme: "light" },
};
