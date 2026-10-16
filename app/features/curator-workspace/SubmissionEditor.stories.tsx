import type { Meta, StoryObj } from "@storybook/react-vite";
import { SubmissionEditor } from "./SubmissionEditor";
import { CuratorShell } from "./CuratorShell";
import { curatorIdentityFixture } from "./fixtures";
import type { SubmissionEditView } from "~/types/submission-edit";

const data: SubmissionEditView = {
  id: "20000000-0000-4000-8000-000000000001",
  reference: "SUB-SYNTHETIC-001",
  status: "accepted",
  artistName: "New Signal",
  trackId: "synthetic-track",
  releaseId: "synthetic-release",
  revision: "{}",
  editable: true,
  coverUrl: null,
  fields: {
    title: "Night Signal",
    releaseTitle: "Night Signal",
    summary: "",
    genres: [],
    moods: [],
    processTags: [],
  },
};
function EditorStory({
  error,
  pending = false,
  covered = false,
  editable = true,
}: {
  error?: string;
  pending?: boolean;
  covered?: boolean;
  editable?: boolean;
}) {
  return (
    <CuratorShell
      activeSection="queue"
      identity={curatorIdentityFixture}
      navigation={[
        { id: "queue", label: "Submissions", href: "/curator/submissions" },
        { id: "collections", label: "Publishing queue", href: "/curator/albums" },
      ]}
    >
      <SubmissionEditor
        data={{ ...data, editable, coverUrl: covered ? "/assets/thumbs/thumb-01.svg" : null }}
        error={error}
        pending={pending}
        onSave={() => undefined}
      />
    </CuratorShell>
  );
}
const meta = {
  title: "Curator Workspace/Submission editing",
  component: EditorStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof EditorStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MissingLegacyArtwork: Story = {};
export const ReplaceArtwork: Story = { args: { covered: true } };
export const Saving: Story = { args: { pending: true } };
export const StaleEdit: Story = {
  args: { error: "This submission changed. Reload the editor before saving." },
};
export const LightTheme: Story = { globals: { theme: "light" } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };

export const ReadOnly: Story = { args: { editable: false } };
