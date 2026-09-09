import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CuratorBadge, CuratorButton, CuratorPanel, CuratorTabs } from "./CuratorPrimitives";
import { CuratorShell } from "./CuratorShell";
import { curatorIdentityFixture, curatorNavigationFixture } from "./fixtures";

type QueueFilter = "all" | "ready" | "mine" | "waiting";

const filterOptions = [
  { id: "all", label: "All", count: 124 },
  { id: "ready", label: "Ready", count: 62 },
  { id: "mine", label: "Mine", count: 8 },
  { id: "waiting", label: "Waiting", count: 23 },
] as const;

function ShellFoundation() {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [lastSearch, setLastSearch] = useState("");
  return (
    <CuratorShell
      activeSection="queue"
      identity={curatorIdentityFixture}
      navigation={curatorNavigationFixture}
      onSearch={setLastSearch}
    >
      <header className="curator-page-heading">
        <div>
          <p className="curator-overline">Curation</p>
          <h1>Submission queue</h1>
          <p>Review and decide what belongs on SunSyn Radio.</p>
        </div>
        <CuratorButton variant="primary">Review next</CuratorButton>
      </header>
      {lastSearch ? <p role="status">Searching for “{lastSearch}”</p> : null}
      <CuratorTabs
        active={filter}
        label="Queue filters"
        onChange={setFilter}
        options={filterOptions}
      />
      <CuratorPanel className="curator-foundation-preview">
        <header>
          <div>
            <p className="curator-overline">Selected submission</p>
            <h2>Midnight Frequency</h2>
            <p>Kairos Bloom · submitted 9 hours ago</p>
          </div>
          <CuratorBadge tone="success">Ready</CuratorBadge>
        </header>
        <div className="curator-foundation-preview__actions">
          <CuratorButton variant="secondary">Play</CuratorButton>
          <CuratorButton variant="ghost">Ask artist</CuratorButton>
          <CuratorButton variant="danger">Decline</CuratorButton>
        </div>
      </CuratorPanel>
    </CuratorShell>
  );
}

const meta = {
  title: "Curator Workspace/Foundations/Shell",
  component: ShellFoundation,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ShellFoundation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = { globals: { theme: "dark" } };
export const LightTheme: Story = { globals: { theme: "light" } };
