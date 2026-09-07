import { Link } from "react-router";

import type { CatalogueItem } from "~/types/catalogue";

interface CatalogueCardProps {
  item: CatalogueItem;
  isSelected: boolean;
  onSelect: (item: CatalogueItem) => void;
  onQueue: (item: CatalogueItem) => void;
  onPlay: (item: CatalogueItem) => void;
}

export function CatalogueCard({ item, isSelected, onSelect, onQueue, onPlay }: CatalogueCardProps) {
  const preventArtworkAction = (event: React.SyntheticEvent) => event.preventDefault();

  return (
    <article className="media-card" data-selected={isSelected ? "true" : undefined}>
      <button
        type="button"
        className="media-card-select"
        aria-label={`Select ${item.description.title}`}
        aria-pressed={isSelected}
        onClick={() => onSelect(item)}
      >
        <img
          src={item.artwork.src}
          alt={item.artwork.alt}
          draggable={false}
          onContextMenu={preventArtworkAction}
          onDragStart={preventArtworkAction}
        />
      </button>
      <div className="media-card-body">
        <Link className="media-card-title" to={item.href}>
          {item.description.title}
        </Link>
        <span className="media-card-description">{item.creator.name}</span>
        <span className="media-card-kind">{item.mediaKind === "audio" ? "Audio" : "Watch"}</span>
        <div className="card-actions">
          <Link to={item.href}>View track</Link>
          <button
            type="button"
            aria-label={
              item.media
                ? `Queue ${item.description.title}`
                : `Queue unavailable for ${item.description.title}; preview coming soon`
            }
            onClick={() => onQueue(item)}
            disabled={!item.media}
          >
            + Queue
          </button>
          <button
            type="button"
            aria-label={
              item.media
                ? `Play ${item.description.title}`
                : `${item.description.title} preview coming soon`
            }
            onClick={() => onPlay(item)}
            disabled={!item.media}
          >
            <span aria-hidden="true">▶</span>
            <span className="visually-hidden">{item.media ? "Play" : "Preview coming soon."}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
