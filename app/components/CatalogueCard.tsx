import { Link } from "react-router";
import { ShareButton } from "~/components/ShareButton";
import { SITE_URL } from "~/config/brand";
import { trackDuration } from "~/services/listening";
import type { CatalogueItem } from "~/types/catalogue";

interface CatalogueCardProps {
  item: CatalogueItem;
  isSelected: boolean;
  isPlaying?: boolean;
  onSelect?: (item: CatalogueItem) => void;
  onQueue: (item: CatalogueItem) => void;
  onPlay: (item: CatalogueItem) => void;
  onPlayNext?: (item: CatalogueItem) => void;
}
export function CatalogueCard({
  item,
  isSelected,
  isPlaying = false,
  onQueue,
  onPlay,
  onPlayNext,
}: CatalogueCardProps) {
  const duration = trackDuration(item.durationMs);
  return (
    <article className="media-card listener-track" data-selected={isSelected || undefined}>
      <Link
        className="media-card-select"
        to={item.href}
        aria-label={`View track: ${item.description.title}`}
      >
        <img src={item.artwork.src} alt="" width="44" height="44" loading="lazy" decoding="async" />
      </Link>
      <div className="media-card-body">
        <Link className="media-card-title" to={item.href}>
          <span>{item.description.title}</span>
        </Link>
        <span className="media-card-description">
          {item.creator.name}
          {duration ? ` · ${duration}` : ""}
        </span>
        <div className="card-actions">
          <button
            type="button"
            className="listener-track__play"
            aria-label={
              item.media
                ? `${isPlaying ? "Pause" : "Play"} ${item.description.title}`
                : `${item.description.title} preview coming soon`
            }
            onClick={() => onPlay(item)}
            disabled={!item.media}
          >
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▸"}</span>
          </button>
          <details className="track-menu">
            <summary role="button" aria-label={`More actions for ${item.description.title}`}>
              <span aria-hidden="true">⋯</span>
            </summary>
            <div className="track-menu__content">
              <button
                type="button"
                aria-label={
                  item.media
                    ? `Queue ${item.description.title}`
                    : `Queue unavailable for ${item.description.title}; preview coming soon`
                }
                disabled={!item.media}
                onClick={(event) => {
                  onQueue(item);
                  const menu = event.currentTarget.closest("details");
                  menu?.removeAttribute("open");
                  menu?.querySelector("summary")?.focus({ preventScroll: true });
                }}
              >
                Add to queue
              </button>
              {onPlayNext ? (
                <button
                  type="button"
                  disabled={!item.media}
                  onClick={(event) => {
                    onPlayNext(item);
                    const menu = event.currentTarget.closest("details");
                    menu?.removeAttribute("open");
                    menu?.querySelector("summary")?.focus({ preventScroll: true });
                  }}
                >
                  Play next
                </button>
              ) : null}
              <ShareButton
                title={item.description.title}
                url={new URL(item.href, SITE_URL).href}
                trackId={item.id}
              />
              <Link to={item.href}>View track</Link>
              <Link to={item.creator.href}>View artist</Link>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}
