import type { Meta, StoryObj } from "@storybook/react-vite";
import { SubmissionReleaseFields } from "./SubmissionReleaseFields";
const meta = {
  title: "Artist submission/Release and discovery",
  component: SubmissionReleaseFields,
  args: {
    release: {
      kind: "single",
      title: "Night Signals",
      summary: "",
      plannedReleaseDate: "",
      labelName: "",
      distributorName: "",
      distributorReleaseId: "",
      territories: ["Worldwide"],
    },
    track: {
      title: "First Light",
      versionTitle: "",
      durationNotes: "",
      isLeadSingle: false,
      lyricsSummary: "",
      isInstrumental: true,
      genres: ["Ambient", "Electronic"],
      moods: ["Calm", "Reflective"],
      processTags: ["Human composition", "Mixing"],
    },
    albums: [{ id: "synthetic-album", title: "Night Signals", artistName: "Kairos Bloom" }],
  },
  decorators: [
    (Story) => (
      <main className="submission-page entity-page">
        <section className="submission-step-card">
          <Story />
        </section>
      </main>
    ),
  ],
} satisfies Meta<typeof SubmissionReleaseFields>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Single: Story = {};
export const Album: Story = {
  args: {
    release: {
      ...meta.args.release,
      kind: "album",
      albumProjectId: "synthetic-album",
      trackNumber: 2,
    },
  },
};
export const Light: Story = { globals: { theme: "light" } };
