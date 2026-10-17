import type { QueueEntry } from "~/types/catalogue";

interface QueueProps {
  entries: QueueEntry[];
  onClear: () => void;
  onSelect: (entry: QueueEntry) => void;
  onRemove: (itemId: string) => void;
  onMove?: (itemId: string, direction: -1 | 1) => void;
}

export function Queue({ entries, onClear, onSelect, onRemove, onMove }: QueueProps) {
  return (
    <section className="queue">
      <div className="queue-head">
        <h2>Next in queue</h2>
        <button type="button" onClick={onClear} disabled={entries.length === 0}>
          Clear all
        </button>
      </div>
      {entries.length > 0 ? (
        <ol>
          {entries.map((entry, index) => (
            <li key={entry.itemId}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div className="queue-entry">
                <button
                  type="button"
                  aria-label={`Play ${entry.title} from queue`}
                  onClick={() => onSelect(entry)}
                >
                  <strong>{entry.title}</strong>
                  <em>{entry.subtitle}</em>
                </button>
                {onMove ? (
                  <div className="queue-move">
                    <button
                      type="button"
                      onClick={() => onMove(entry.itemId, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${entry.title} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(entry.itemId, 1)}
                      disabled={index === entries.length - 1}
                      aria-label={`Move ${entry.title} down`}
                    >
                      ↓
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="queue-remove"
                  aria-label={`Remove ${entry.title} from queue`}
                  onClick={() => onRemove(entry.itemId)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="queue-empty">Queue is clear. Add tracks from their menu while you explore.</p>
      )}
    </section>
  );
}
