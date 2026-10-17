import { Link } from "react-router";
import { trackDuration } from "~/services/listening";
import type { CatalogueItem, PublicEditorialCollection } from "~/types/catalogue";

export function RadioStart({
  tracks,
  collection,
  onPlay,
}: {
  tracks: CatalogueItem[];
  collection?: PublicEditorialCollection;
  onPlay?: () => void;
}) {
  const duration =
    tracks.length && tracks.every((track) => track.durationMs)
      ? trackDuration(tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0))
      : null;
  return (
    <section className="radio-start" aria-labelledby="radio-start-title">
      <p className="eyebrow">Human-curated · AI-assisted music</p>
      <h1 id="radio-start-title">Start listening.</h1>
      <p className="radio-start__description">
        {collection ? (
          <Link to={`/collections/${collection.slug}`}>{collection.name}</Link>
        ) : (
          "A radio for music made with intent."
        )}
      </p>
      {collection?.description ? (
        <p className="radio-start__note">{collection.description}</p>
      ) : null}
      <p className="radio-start__meta">
        {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
        {duration ? ` · ${duration}` : ""}
      </p>
      <button
        type="button"
        className="listener-primary"
        disabled={!tracks.length || !onPlay}
        onClick={onPlay}
      >
        <span aria-hidden="true">▸</span> Play the selection
      </button>
      {tracks.length ? <small>Plays in selection order. Replaces your queue.</small> : null}
    </section>
  );
}
