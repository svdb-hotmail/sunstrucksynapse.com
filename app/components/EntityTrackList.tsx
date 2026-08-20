import { Link } from "react-router";

import type { CatalogueItem, PlayerOutletContext } from "~/types/catalogue";

interface EntityTrackListProps {
  tracks: CatalogueItem[];
  player: PlayerOutletContext;
  collectionId?: string;
}

export function EntityTrackList({ tracks, player, collectionId }: EntityTrackListProps) {
  return (
    <ol className="entity-track-list">
      {tracks.map((track) => (
        <li key={track.id} data-selected={player.selectedItemId === track.id || undefined}>
          <img src={track.artwork.src} alt={track.artwork.alt} />
          <div>
            <Link to={track.href}>{track.description.title}</Link>
            <span>{track.description.subtitle}</span>
          </div>
          <div className="entity-track-actions">
            <button
              type="button"
              onClick={() => player.queueItem(track, collectionId)}
              disabled={!track.media}
            >
              Queue
            </button>
            <button
              type="button"
              onClick={() => player.playItem(track, collectionId)}
              disabled={!track.media}
            >
              {track.media ? "Play" : "Unavailable"}
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
