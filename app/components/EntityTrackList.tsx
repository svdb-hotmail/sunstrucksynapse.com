import { CatalogueCard } from "~/components/CatalogueCard";
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
        <li key={track.id}>
          <CatalogueCard
            item={track}
            isSelected={player.selectedItemId === track.id}
            isPlaying={player.playingItemId === track.id}
            onPlay={() => player.playItem(track, collectionId)}
            onQueue={() => player.queueItem(track, collectionId)}
            onPlayNext={player.playNext ? () => player.playNext?.(track, collectionId) : undefined}
          />
        </li>
      ))}
    </ol>
  );
}
