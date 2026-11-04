import { Link } from "react-router";
import { ShareButton } from "~/components/ShareButton";
import { SITE_URL } from "~/config/brand";
import { trackDuration } from "~/services/listening";
import type { CatalogueItem } from "~/types/catalogue";
import { ListenerIcon } from "~/design-system/ListenerIcon";
import { trackLabel } from "~/design-system/track-label";
import { Artwork } from "~/design-system/Artwork";

interface CatalogueCardProps {
  item: CatalogueItem;
  isSelected: boolean;
  isPlaying?: boolean;
  onSelect?: (item: CatalogueItem) => void;
  onQueue: (item: CatalogueItem) => void;
  onPlay: (item: CatalogueItem) => void;
  onPlayNext?: (item: CatalogueItem) => void;
  position?: number;
  simpleActions?: boolean;
}
export function CatalogueCard({
  item,
  isSelected,
  isPlaying = false,
  onQueue,
  onPlay,
  onPlayNext,
  position,
  simpleActions = false,
}: CatalogueCardProps) {
  const duration = trackDuration(item.durationMs);
  const label = trackLabel(item.description.title);
  return (
    <article
      className="media-card listener-track track-row"
      data-selected={isSelected || undefined}
    >
      <span className="track-number" aria-hidden="true">
        {String(position ?? 1).padStart(2, "0")}
      </span>
      <Link
        className="media-card-select"
        to={item.href}
        aria-label={`View track: ${item.description.title}`}
      >
        <Artwork artwork={item.artwork} decorative />
      </Link>
      <div className="media-card-body">
        <Link className="media-card-title" to={item.href} aria-label={item.description.title}>
          <span>{label.title}</span>
        </Link>
        <span className="media-card-description">
          {item.creator.name}
          {label.subtitle ? ` · ${label.subtitle}` : ""}
          {duration ? ` · ${duration}` : ""}
        </span>
        <div className="card-actions">
          <span className="track-format">{item.mediaKind === "audio" ? "AUDIO" : "VIDEO"}</span>
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
            <ListenerIcon name={isPlaying ? "pause" : "play"} />
          </button>
          {simpleActions ? (
            <button
              type="button"
              className="track-queue brand-button-secondary"
              aria-label={`Queue ${item.description.title}`}
              disabled={!item.media}
              onClick={() => onQueue(item)}
            >
              <ListenerIcon name="plus" />
            </button>
          ) : (
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
          )}
        </div>
      </div>
    </article>
  );
}
