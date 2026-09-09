import type { Meta, StoryObj } from "@storybook/react-vite";

import { ReviewAudioUploader } from "~/components/ReviewAudioUploader";

const meta = {
  title: "Production/ReviewAudioUploader",
  component: ReviewAudioUploader,
  tags: ["autodocs"],
  args: { endpoint: "/storybook-review-audio" },
} satisfies Meta<typeof ReviewAudioUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const ReadyToReplace: Story = {
  args: { currentAudio: { filename: "the-new-signal.flac", version: 2 } },
};

export const SaveDraftFirst: Story = { args: { disabled: true } };
