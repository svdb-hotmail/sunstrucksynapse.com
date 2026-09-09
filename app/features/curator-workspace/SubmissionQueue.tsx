import type { KeyboardEvent } from "react";

import { CuratorBadge, CuratorTabs } from "./CuratorPrimitives";
import type { CuratorQueueItemView } from "./types";

export type QueueFilter = "all" | "ready" | "mine" | "needs_audio" | "flagged" | "completed";

export const queueFilterOptions = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "mine", label: "Mine" },
  { id: "needs_audio", label: "Needs audio" },
  { id: "flagged", label: "Flagged" },
  { id: "completed", label: "Completed" },
] as const;

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return "—";
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function timeAgo(timestamp: string) {
  const hours = Math.max(
    1,
    Math.round((Date.UTC(2026, 8, 9, 17) - new Date(timestamp).getTime()) / 3_600_000),
  );
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function statusTone(status: CuratorQueueItemView["status"]) {
  if (status === "received") return "success";
  if (status === "listening") return "info";
  if (status === "eligibility_review" || status === "clarification_requested") return "warning";
  if (status === "rejected" || status === "withdrawn") return "danger";
  return "neutral";
}

function readinessLabel(readiness: CuratorQueueItemView["readiness"]) {
  switch (readiness) {
    case "ready":
      return "Ready";
    case "needs_audio":
      return "No audio";
    case "needs_information":
      return "Waiting";
    case "flagged":
      return "Flagged";
  }
}

export function SubmissionQueue({
  activeFilter,
  filterCounts,
  items,
  playingId,
  selectedId,
  onFilterChange,
  onSelect,
  onTogglePlayback,
}: {
  activeFilter: QueueFilter;
  filterCounts: Record<QueueFilter, number>;
  items: readonly CuratorQueueItemView[];
  playingId: string | null;
  selectedId: string | null;
  onFilterChange: (filter: QueueFilter) => void;
  onSelect: (item: CuratorQueueItemView) => void;
  onTogglePlayback: (item: CuratorQueueItemView) => void;
}) {
  const navigate = (event: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    if (event.key === "Enter") {
      onSelect(items[index]!);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      onTogglePlayback(items[index]!);
      return;
    }
    const nextIndex =
      event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : -1;
    if (nextIndex >= 0 && nextIndex < items.length) {
      event.preventDefault();
      const nextRow = event.currentTarget.parentElement?.children.item(
        nextIndex,
      ) as HTMLElement | null;
      nextRow?.focus();
      onSelect(items[nextIndex]!);
    }
  };

  const options = queueFilterOptions.map((option) => ({
    ...option,
    count: filterCounts[option.id],
  }));

  return (
    <section className="curator-queue" aria-labelledby="submission-queue-heading">
      <CuratorTabs
        active={activeFilter}
        label="Submission queue filters"
        onChange={onFilterChange}
        options={options}
      />
      <div className="curator-queue__table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Play</th>
              <th scope="col">Track</th>
              <th scope="col">Artist</th>
              <th scope="col">Status</th>
              <th scope="col">Readiness</th>
              <th scope="col">Rights</th>
              <th scope="col">Length</th>
              <th scope="col">Submitted</th>
              <th scope="col">Curator</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const selected = item.id === selectedId;
              const playing = item.id === playingId;
              return (
                <tr
                  key={item.id}
                  tabIndex={0}
                  aria-selected={selected}
                  className={selected ? "is-selected" : undefined}
                  onClick={() => onSelect(item)}
                  onKeyDown={(event) => navigate(event, index)}
                >
                  <td>
                    <button
                      type="button"
                      className="curator-queue__play"
                      aria-label={`${playing ? "Pause" : "Play"} ${item.title}`}
                      disabled={!item.audioUrl}
                      onClick={(event) => {
                        event.stopPropagation();
                        onTogglePlayback(item);
                      }}
                    >
                      {playing ? "Ⅱ" : "▶"}
                    </button>
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.publicReference}</small>
                  </td>
                  <td>{item.artistName}</td>
                  <td>
                    <CuratorBadge tone={statusTone(item.status)}>
                      {item.status.replaceAll("_", " ")}
                    </CuratorBadge>
                  </td>
                  <td data-state={item.readiness}>{readinessLabel(item.readiness)}</td>
                  <td>{item.rights === "attested" ? "Attested" : "Review"}</td>
                  <td>{formatDuration(item.durationMs)}</td>
                  <td>{timeAgo(item.submittedAt)}</td>
                  <td>{item.assignedCuratorName ?? "Unassigned"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 ? (
          <div className="curator-queue__empty">
            <strong>No submissions match this view.</strong>
            <span>Adjust the search or choose another queue.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
