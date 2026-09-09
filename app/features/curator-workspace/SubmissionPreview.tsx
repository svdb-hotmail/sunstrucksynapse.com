import { CuratorBadge, CuratorButton, CuratorPanel } from "./CuratorPrimitives";
import type { CuratorQueueItemView } from "./types";

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return "—";
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function statusLabel(status: CuratorQueueItemView["status"]) {
  return status.replaceAll("_", " ");
}

export function SubmissionPreview({
  item,
  isPlaying,
  onOpenReview,
  onTogglePlayback,
}: {
  item: CuratorQueueItemView | null;
  isPlaying: boolean;
  onOpenReview: (item: CuratorQueueItemView) => void;
  onTogglePlayback: (item: CuratorQueueItemView) => void;
}) {
  if (!item) {
    return (
      <CuratorPanel className="curator-preview curator-preview--empty">
        <p>Select a submission to see its listening copy and review status.</p>
      </CuratorPanel>
    );
  }

  return (
    <CuratorPanel className="curator-preview">
      <div className="curator-preview__identity">
        <div className="curator-artwork" aria-hidden="true">
          <span>{initials(item.artistName)}</span>
        </div>
        <div>
          <p className="curator-preview__reference">{item.publicReference}</p>
          <h2>{item.title}</h2>
          <p>{item.artistName}</p>
        </div>
      </div>
      <div className="curator-preview__player">
        <CuratorButton
          variant="secondary"
          aria-label={`${isPlaying ? "Pause" : "Play"} ${item.title}`}
          disabled={!item.audioUrl}
          onClick={() => onTogglePlayback(item)}
        >
          {isPlaying ? "Pause" : "Play"}
        </CuratorButton>
        <div className="curator-preview__wave" aria-hidden="true">
          <span className={isPlaying ? "is-playing" : undefined} />
        </div>
        <span>{formatDuration(item.durationMs)}</span>
      </div>
      <dl className="curator-preview__facts">
        <div>
          <dt>Status</dt>
          <dd>
            <CuratorBadge tone={item.status === "received" ? "success" : "info"}>
              {statusLabel(item.status)}
            </CuratorBadge>
          </dd>
        </div>
        <div>
          <dt>Listening copy</dt>
          <dd>{item.audioUrl ? "Ready" : "Missing"}</dd>
        </div>
        <div>
          <dt>Rights</dt>
          <dd>{item.rights === "attested" ? "Attested" : "Needs review"}</dd>
        </div>
      </dl>
      <div className="curator-preview__scores" aria-label="Curator scores">
        {["Artistic quality", "Originality", "Production", "Editorial fit"].map((criterion) => (
          <span key={criterion}>
            <small>{criterion}</small>
            <strong>—</strong>
          </span>
        ))}
      </div>
      <label className="curator-preview__note">
        Curator note
        <textarea rows={4} placeholder="Add notes during your audition…" />
      </label>
      <CuratorButton
        className="curator-preview__open"
        variant="primary"
        disabled={!item.audioUrl}
        onClick={() => onOpenReview(item)}
      >
        Open full review →
      </CuratorButton>
    </CuratorPanel>
  );
}
