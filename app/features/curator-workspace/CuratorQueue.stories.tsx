import { useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CuratorButton } from "./CuratorPrimitives";
import { CuratorShell } from "./CuratorShell";
import {
  createCuratorQueueFixtures,
  curatorIdentityFixture,
  curatorNavigationFixture,
} from "./fixtures";
import { SubmissionPreview } from "./SubmissionPreview";
import { SubmissionQueue, type QueueFilter } from "./SubmissionQueue";
import type { CuratorQueueItemView } from "./types";

const allItems = createCuratorQueueFixtures();
const completedStatuses = new Set<CuratorQueueItemView["status"]>([
  "accepted",
  "rejected",
  "withdrawn",
]);

function matchesFilter(item: CuratorQueueItemView, filter: QueueFilter) {
  switch (filter) {
    case "ready":
      return item.readiness === "ready" && !completedStatuses.has(item.status);
    case "mine":
      return item.assignedCuratorName !== null;
    case "needs_audio":
      return item.readiness === "needs_audio";
    case "flagged":
      return item.readiness === "flagged" || item.rights !== "attested";
    case "completed":
      return completedStatuses.has(item.status);
    case "all":
      return true;
  }
}

function QueuePrototype() {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(allItems[0]!.id);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        (["all", "ready", "mine", "needs_audio", "flagged", "completed"] as const).map(
          (candidate) => [
            candidate,
            allItems.filter((item) => matchesFilter(item, candidate)).length,
          ],
        ),
      ) as Record<QueueFilter, number>,
    [],
  );
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allItems
      .filter((item) => matchesFilter(item, filter))
      .filter(
        (item) =>
          !normalizedQuery ||
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.artistName.toLowerCase().includes(normalizedQuery) ||
          item.publicReference.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 50);
  }, [filter, query]);
  const selected = allItems.find((item) => item.id === selectedId) ?? null;

  const togglePlayback = async (item: CuratorQueueItemView) => {
    const audio = audioRef.current;
    if (!audio || !item.audioUrl) return;
    if (playingId === item.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = item.audioUrl;
    try {
      await audio.play();
      setPlayingId(item.id);
      setSelectedId(item.id);
    } catch {
      setPlayingId(null);
    }
  };

  return (
    <CuratorShell
      activeSection="queue"
      identity={curatorIdentityFixture}
      navigation={curatorNavigationFixture}
      onSearch={setQuery}
      searchValue={query}
    >
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      <header className="curator-page-heading">
        <div>
          <p className="curator-overline">Curation</p>
          <h1 id="submission-queue-heading">Submission queue</h1>
          <p>{allItems.length} submissions · oldest ready work first</p>
        </div>
        <CuratorButton variant="primary">Review next ready submission →</CuratorButton>
      </header>
      <div className="curator-queue-layout">
        <SubmissionQueue
          activeFilter={filter}
          filterCounts={filterCounts}
          items={visibleItems}
          playingId={playingId}
          selectedId={selectedId}
          onFilterChange={setFilter}
          onSelect={(item) => setSelectedId(item.id)}
          onTogglePlayback={togglePlayback}
        />
        <SubmissionPreview
          item={selected}
          isPlaying={selected?.id === playingId}
          onOpenReview={() => undefined}
          onTogglePlayback={togglePlayback}
        />
      </div>
    </CuratorShell>
  );
}

const meta = {
  title: "Curator Workspace/Queue/Interactive prototype",
  component: QueuePrototype,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof QueuePrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = { globals: { theme: "dark" } };
export const LightTheme: Story = { globals: { theme: "light" } };
