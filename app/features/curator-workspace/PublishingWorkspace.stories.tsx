import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CuratorShell } from "./CuratorShell";
import { PublishingWorkspace } from "./PublishingWorkspace";
import { curatorIdentityFixture } from "./fixtures";
function PreparedReleaseStory({
  ready = false,
  available = true,
}: {
  ready?: boolean;
  available?: boolean;
}) {
  const [publicUrl, setPublicUrl] = useState<string>();
  return (
    <CuratorShell
      activeSection="collections"
      identity={curatorIdentityFixture}
      navigation={[
        { id: "queue", label: "Review queue", href: "/curator/submissions" },
        { id: "collections", label: "Publishing queue", href: "/curator/albums" },
      ]}
    >
      <PublishingWorkspace
        title="Night Signals"
        artistName="Kairos Bloom"
        releaseKind="album"
        coverPreviewUrl="/assets/thumbs/thumb-01.svg"
        encodingAvailable={available}
        tracks={["First Light", "Midnight Frequency", "Last Signal"].map((title, i) => ({
          id: `fixture-${i}`,
          title,
          position: i + 1,
          genre: "Ambient",
          genres: ["Ambient", "Electronic"],
          moods: ["Reflective"],
          processTags: ["Human composition"],
          preparationStatus: ready ? "ready" : "queued",
          coverId: "synthetic-cover",
          failureCode: null,
        }))}
        readiness={
          ready
            ? []
            : [
                {
                  id: "fixture-album",
                  title: "Night Signals",
                  blockers: ["Automatic streaming preparation in progress"],
                },
              ]
        }
        onPublish={() => setPublicUrl("/releases/night-signals")}
        publicUrl={publicUrl}
        onRetry={() => undefined}
        onRefresh={() => undefined}
      />
    </CuratorShell>
  );
}
const meta = {
  title: "Curator Workspace/Publishing/Automatic preparation",
  component: PreparedReleaseStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PreparedReleaseStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Preparing: Story = {};
export const Ready: Story = { args: { ready: true } };
export const WaitingForService: Story = { args: { available: false } };
export const LightTheme: Story = { globals: { theme: "light" }, args: { ready: true } };
