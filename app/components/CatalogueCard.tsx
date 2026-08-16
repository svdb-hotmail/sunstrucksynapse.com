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
        <strong className="media-card-title">{item.description.title}</strong>
        <span className="media-card-description">{item.description.subtitle}</span>
        <div className="card-actions">
          <button
            type="button"
            aria-label={`Queue ${item.description.title}`}
            onClick={() => onQueue(item)}
          >
            Queue
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
            {item.media ? "Play" : "Preview coming soon."}
          </button>
        </div>
      </div>
    </article>
  );
}
