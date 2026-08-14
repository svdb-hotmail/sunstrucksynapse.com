import type { QueueEntry } from "~/types/catalogue";

interface QueueProps {
  entries: QueueEntry[];
  onClear: () => void;
}

export function Queue({ entries, onClear }: QueueProps) {
  return (
    <section className="queue">
      <div className="queue-head">
        <h2>Next in queue</h2>
        <button type="button" onClick={onClear} disabled={entries.length === 0}>Clear all</button>
      </div>
      {entries.length > 0 ? (
        <ol>
          {entries.map((entry, index) => (
            <li key={entry.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{entry.title}</strong>
              <em>{entry.subtitle}</em>
            </li>
          ))}
        </ol>
      ) : (
        <p className="queue-empty">Queue is clear.</p>
      )}
    </section>
  );
}
