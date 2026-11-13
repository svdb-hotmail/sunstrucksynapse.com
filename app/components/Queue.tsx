import { useRef, useState } from "react";
import type { QueueEntry } from "~/types/catalogue";

interface QueueProps {
  entries: QueueEntry[];
  onClear: () => void;
  onSelect: (entry: QueueEntry) => void;
  onRemove: (itemId: string) => void;
  onMove?: (itemId: string, direction: -1 | 1) => void;
  onReorder?: (itemId: string, targetItemId: string) => void;
  currentItemId?: string | null;
  currentEntry?: QueueEntry | null;
  isPlaying?: boolean;
}

export function Queue({
  entries,
  onClear,
  onSelect,
  onRemove,
  onMove,
  onReorder,
  currentItemId,
  currentEntry,
  isPlaying,
}: QueueProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const dragging = useRef<{
    id: string;
    startY: number;
    deltaY: number;
    targetId: string | null;
  } | null>(null);
  const [dragVisual, setDragVisual] = useState<{
    id: string;
    deltaY: number;
    targetId: string | null;
  } | null>(null);
  const rows = currentEntry
    ? [currentEntry, ...entries.filter((entry) => entry.itemId !== currentEntry.itemId)]
    : entries;
  return (
    <section className="queue">
      <div className="queue-head">
        <h2>Queue</h2>
        <button type="button" onClick={onClear} disabled={entries.length === 0}>
          Clear all
        </button>
      </div>
      {rows.length > 0 ? (
        <ol ref={listRef}>
          {rows.map((entry, index) => {
            const isCurrent =
              entry.itemId === currentItemId || entry.itemId === currentEntry?.itemId;
            return (
              <li
                key={entry.itemId}
                data-current={isCurrent || undefined}
                data-queue-id={entry.itemId}
                data-dragging={dragVisual?.id === entry.itemId || undefined}
                data-drop-target={dragVisual?.targetId === entry.itemId || undefined}
                style={
                  dragVisual?.id === entry.itemId
                    ? { transform: `translateY(${dragVisual.deltaY}px)` }
                    : undefined
                }
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div className="queue-entry">
                  {onMove && !isCurrent ? (
                    <button
                      type="button"
                      className="queue-drag"
                      aria-label={`Drag ${entry.title} to reorder; use arrow keys to move it`}
                      onPointerDown={(event) => {
                        dragging.current = {
                          id: entry.itemId,
                          startY: event.clientY,
                          deltaY: 0,
                          targetId: null,
                        };
                        setDragVisual({ id: entry.itemId, deltaY: 0, targetId: null });
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        const drag = dragging.current;
                        if (drag?.id !== entry.itemId) return;
                        const deltaY = event.clientY - drag.startY;
                        const candidates = Array.from(
                          listRef.current?.querySelectorAll<HTMLElement>("li[data-queue-id]") ?? [],
                        ).filter(
                          (row) =>
                            row.dataset.queueId !== entry.itemId &&
                            entries.some((queued) => queued.itemId === row.dataset.queueId),
                        );
                        const closest = candidates.reduce<HTMLElement | null>((best, row) => {
                          const center =
                            row.getBoundingClientRect().top +
                            row.getBoundingClientRect().height / 2;
                          if (!best) return row;
                          const bestCenter =
                            best.getBoundingClientRect().top +
                            best.getBoundingClientRect().height / 2;
                          return Math.abs(center - event.clientY) <
                            Math.abs(bestCenter - event.clientY)
                            ? row
                            : best;
                        }, null);
                        const targetId =
                          Math.abs(deltaY) > 8 ? (closest?.dataset.queueId ?? null) : null;
                        dragging.current = { ...drag, deltaY, targetId };
                        setDragVisual({ id: entry.itemId, deltaY, targetId });
                      }}
                      onPointerUp={() => {
                        const drag = dragging.current;
                        dragging.current = null;
                        setDragVisual(null);
                        if (drag?.targetId) onReorder?.(entry.itemId, drag.targetId);
                      }}
                      onPointerCancel={() => {
                        dragging.current = null;
                        setDragVisual(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                          event.preventDefault();
                          onMove(entry.itemId, event.key === "ArrowUp" ? -1 : 1);
                        }
                      }}
                    >
                      <span aria-hidden="true">⠿</span>
                    </button>
                  ) : (
                    <span className="queue-drag-spacer" aria-hidden="true" />
                  )}
                  <button
                    className="queue-track-button"
                    type="button"
                    aria-label={`Play ${entry.title} from queue`}
                    onClick={() => onSelect(entry)}
                  >
                    {isCurrent ? (
                      <span className="queue-playing-label">
                        {isPlaying ? "Now playing" : "Paused"}
                      </span>
                    ) : null}
                    <strong>{entry.title}</strong>
                    <em>{entry.subtitle}</em>
                  </button>
                  {!isCurrent ? (
                    <button
                      type="button"
                      className="queue-remove"
                      aria-label={`Remove ${entry.title} from queue`}
                      onClick={() => onRemove(entry.itemId)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="queue-empty">Queue is clear. Use the plus button on a track to add it.</p>
      )}
    </section>
  );
}
