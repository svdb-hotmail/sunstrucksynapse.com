import { CatalogueCard } from "~/components/CatalogueCard";
import { useLocation } from "react-router";
import type { CatalogueItem, PlayerOutletContext } from "~/types/catalogue";
interface EntityTrackListProps {
  tracks: CatalogueItem[];
  player: PlayerOutletContext;
  collectionId?: string;
}
export function EntityTrackList({ tracks, player, collectionId }: EntityTrackListProps) {
  const { hash } = useLocation();
  return (
    <ol className="entity-track-list">
      {tracks.map((track, index) => (
        <li
          key={track.id}
          id={`track-${track.slug}`}
          data-targeted={hash === `#track-${track.slug}` || undefined}
        >
          <CatalogueCard
            item={track}
            showShare
            position={index + 1}
            isSelected={player.selectedItemId === track.id}
            isPlaying={player.playingItemId === track.id}
            isQueued={
              player.queuedItemIds?.includes(track.id) || player.selectedItemId === track.id
            }
            onPlay={() => player.playItem(track, collectionId)}
            onQueue={() => player.queueItem(track, collectionId)}
          />
        </li>
      ))}
    </ol>
  );
}
