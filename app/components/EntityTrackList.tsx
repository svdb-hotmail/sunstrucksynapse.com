import { CatalogueCard } from "~/components/CatalogueCard";
import type { CatalogueItem, PlayerOutletContext } from "~/types/catalogue";
interface EntityTrackListProps {
  tracks: CatalogueItem[];
  player: PlayerOutletContext;
  collectionId?: string;
  simpleActions?: boolean;
}
export function EntityTrackList({
  tracks,
  player,
  collectionId,
  simpleActions,
}: EntityTrackListProps) {
  return (
    <ol className="entity-track-list">
      {tracks.map((track, index) => (
        <li key={track.id}>
          <CatalogueCard
            item={track}
            position={index + 1}
            simpleActions={simpleActions}
            isSelected={player.selectedItemId === track.id}
            isPlaying={player.playingItemId === track.id}
            isQueued={
              player.queuedItemIds?.includes(track.id) || player.selectedItemId === track.id
            }
            onPlay={() => player.playItem(track, collectionId)}
            onQueue={() => player.queueItem(track, collectionId)}
            onPlayNext={player.playNext ? () => player.playNext?.(track, collectionId) : undefined}
          />
        </li>
      ))}
    </ol>
  );
}
