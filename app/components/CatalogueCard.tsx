import type { CatalogueItem } from "~/types/catalogue";

interface CatalogueCardProps {
  item: CatalogueItem;
  isSelected: boolean;
  onSelect: (item: CatalogueItem) => void;
}

export function CatalogueCard({ item, isSelected, onSelect }: CatalogueCardProps) {
  const preventArtworkAction = (event: React.SyntheticEvent) => event.preventDefault();

  return (
    <button
      type="button"
      className="media-card"
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
      <span className="media-card-body">
        <strong className="media-card-title">{item.description.title}</strong>
        <span className="media-card-description">{item.description.subtitle}</span>
        <span className="card-actions" aria-hidden="true">
          <span>Queue</span>
          <span>Play</span>
          <span>Share</span>
        </span>
      </span>
    </button>
  );
}
