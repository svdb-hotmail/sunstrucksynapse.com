import { Link } from "react-router";

import { CatalogueCard } from "~/components/CatalogueCard";
import type { CatalogueItem, CatalogueSection as CatalogueSectionModel } from "~/types/catalogue";

interface CatalogueSectionProps {
  section: CatalogueSectionModel;
  selectedItemId: string | null;
  onSelect: (item: CatalogueItem) => void;
  onQueue: (item: CatalogueItem) => void;
  onPlay: (item: CatalogueItem) => void;
}

export function CatalogueSection({
  section,
  selectedItemId,
  onSelect,
  onQueue,
  onPlay,
}: CatalogueSectionProps) {
  return (
    <section id={section.id} className="media-section">
      <div className="section-title">
        <h2>
          <span className="section-icon" aria-hidden="true">
            {section.icon}
          </span>
          {section.title}
        </h2>
        <Link to={section.href}>View collection</Link>
      </div>

      <div className="media-row">
        {section.items.map((item) => (
          <CatalogueCard
            item={item}
            isSelected={item.id === selectedItemId}
            onSelect={onSelect}
            onQueue={onQueue}
            onPlay={onPlay}
            key={item.id}
          />
        ))}
      </div>
    </section>
  );
}
