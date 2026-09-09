import type { Meta, StoryObj } from "@storybook/react-vite";

import { CurationScorecard } from "~/components/CurationScorecard";

const meta = {
  title: "Production/CurationScorecard",
  component: CurationScorecard,
  tags: ["autodocs"],
  args: {
    submissionId: "story-submission",
    audio: { id: "story-audio", filename: "new-signal-master.flac", durationMs: 248000 },
  },
} satisfies Meta<typeof CurationScorecard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToReview: Story = {};
export const WaitingForAudio: Story = { args: { audio: null } };
