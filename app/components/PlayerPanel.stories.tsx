import type { Ref } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { PlayerPanel } from "~/components/PlayerPanel";
import type { CatalogueItem, QueueEntry } from "~/types/catalogue";

const audioItem: CatalogueItem = {
  id: "story-player-audio",
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

const unavailableItem: CatalogueItem = {
  ...audioItem,
  id: "story-player-unavailable",
  slug: "quiet-machines",
  href: "/tracks/phase-zero-transmissions/quiet-machines",
  artwork: { src: "/assets/thumbs/thumb-06.svg", alt: "Quiet Machines artwork" },
  description: {
    title: "Quiet Machines",
    subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
  },
  media: undefined,
};

const queue: QueueEntry[] = [
  {
    itemId: "story-player-queue",
    title: "The Mushroom Circle",
    subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
  },
];

const callbacks = {
  onClearQueue: () => undefined,
  onSelectQueueEntry: () => undefined,
  onRemoveQueueEntry: () => undefined,
  onPrevious: () => undefined,
  onNext: () => undefined,
  onMediaEnded: () => undefined,
};

interface PlayerPanelStoryArgs {
  item: CatalogueItem | null;
  queue: QueueEntry[];
  playbackRequest: { itemId: string; sequence: number; collectionId?: string } | null;
  onClearQueue: () => void;
  onSelectQueueEntry: (entry: QueueEntry) => void;
  onRemoveQueueEntry: (itemId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  onMediaEnded: () => void;
  playerPanelRef?: Ref<HTMLElement>;
}

function PlayerPanelStory({ playerPanelRef, ...props }: PlayerPanelStoryArgs) {
  return <PlayerPanel ref={playerPanelRef} {...props} />;
}

const meta: Meta<PlayerPanelStoryArgs> = {
  title: "Production/PlayerPanel",
  component: PlayerPanelStory,
  tags: ["autodocs"],
  args: {
    ...callbacks,
    queue: [],
    playbackRequest: null,
    canPrevious: false,
    canNext: false,
  },
  parameters: {
    docs: {
      description: {
        component:
          "The production player shell with deterministic catalogue data. Stories never request playback; media controls remain available for intentional manual inspection. The unavailable preview is prop-driven; the internal native-media error overlay is intentionally not forced because it records a playback-error analytics event.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<PlayerPanelStoryArgs>;

export const ReadyAudio: Story = {
  args: { item: audioItem, queue },
};

export const UnavailablePreview: Story = {
  args: { item: unavailableItem },
};

export const EmptyCatalogue: Story = {
  args: { item: null },
};

export const LightTheme: Story = {
  args: { item: audioItem, queue },
  globals: { theme: "light" },
};
