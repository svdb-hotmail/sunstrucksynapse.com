import type { Meta, StoryObj } from "@storybook/react-vite";

import { NowPlaying } from "~/components/NowPlaying";
import type { CatalogueItem } from "~/types/catalogue";

const item: CatalogueItem = {
  id: "story-now-playing",
  slug: "revolution-will-be-televised",
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
  href: "/tracks/phase-zero-transmissions/revolution-will-be-televised",
  artwork: {
    src: "/assets/thumbs/thumb-02.svg",
    alt: "Revolution Will Be Televised artwork",
  },
  description: {
    title: "Revolution Will Be Televised",
    subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
  },
  mediaKind: "audio",
  media: {
    src: "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
    mimeType: "audio/mpeg",
  },
};

interface NowPlayingStoryArgs {
  item: CatalogueItem;
}

const meta: Meta<NowPlayingStoryArgs> = {
  title: "Production/NowPlaying",
  component: NowPlaying,
  tags: ["autodocs"],
  args: { item },
  parameters: {
    docs: {
      description: {
        component: "The production now-playing title and release context used by the player.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<NowPlayingStoryArgs>;

export const Active: Story = {};

export const LightTheme: Story = {
  globals: { theme: "light" },
};
