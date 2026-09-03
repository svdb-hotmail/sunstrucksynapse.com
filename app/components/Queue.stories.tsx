import type { Meta, StoryObj } from "@storybook/react-vite";

import { Queue } from "~/components/Queue";
import type { QueueEntry } from "~/types/catalogue";

const entries: QueueEntry[] = [
  {
    itemId: "story-queue-mushroom",
    title: "The Mushroom Circle",
    subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
  },
  {
    itemId: "story-queue-revolution",
    title: "Revolution Will Be Televised",
    subtitle: "Phase Zero Transmissions · Sunstruck Synapse",
    collectionId: "latest-transmissions",
  },
];

const callbacks = {
  onClear: () => undefined,
  onSelect: () => undefined,
  onRemove: () => undefined,
};

const meta = {
  title: "Production/Queue",
  component: Queue,
  tags: ["autodocs"],
  args: callbacks,
  parameters: {
    docs: {
      description: {
        component:
          "The production playback queue, including populated and empty states. Callbacks are intentionally inert in the catalogue preview.",
      },
    },
  },
} satisfies Meta<typeof Queue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: { entries },
};

export const Empty: Story = {
  args: { entries: [] },
};

export const LightTheme: Story = {
  args: { entries },
  globals: { theme: "light" },
};
