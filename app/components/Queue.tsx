import type { QueueEntry } from "~/types/catalogue";

interface QueueProps {
  entries: QueueEntry[];
  onClear: () => void;
  onSelect: (entry: QueueEntry) => void;
}

export function Queue({ entries, onClear, onSelect }: QueueProps) {
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
              <button
                type="button"
                aria-label={`Play ${entry.title} from queue`}
                onClick={() => onSelect(entry)}
              >
                <strong>{entry.title}</strong>
                <em>{entry.subtitle}</em>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="queue-empty">Queue is clear.</p>
      )}
    </section>
  );
}
