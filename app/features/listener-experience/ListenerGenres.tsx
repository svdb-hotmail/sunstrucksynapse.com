import { useMemo, useState } from "react";
import { Link } from "react-router";

import { CatalogueSection } from "~/components/CatalogueSection";
import type { CatalogueItem } from "~/types/catalogue";

import type { ListenerGenreView } from "./fixtures";
import type { ListenerPrototypeContext } from "./ListenerProductPrototype";

const itemsById = (items: CatalogueItem[]) => new Map(items.map((item) => [item.id, item]));

interface GenreRailProps {
  genres: ListenerGenreView[];
  items: CatalogueItem[];
  onSelectGenre?: (slug: string) => void;
}

export function GenreRail({ genres, items, onSelectGenre }: GenreRailProps) {
  const itemLookup = useMemo(() => itemsById(items), [items]);

  return (
    <section id="genres" className="genre-rail" aria-labelledby="genre-rail-title">
      <div className="section-title">
        <h2 id="genre-rail-title">
          <span className="section-icon" aria-hidden="true">
            ◌
          </span>
          Browse genres
        </h2>
        <a href="/genres">View all genres</a>
      </div>
      <div className="genre-rail__items">
        {genres.map((genre) => {
          const cover = itemLookup.get(genre.itemIds[0]!)?.artwork;
          const content = (
            <>
              {cover ? <img src={cover.src} alt="" aria-hidden="true" /> : null}
              <span>
                <strong>{genre.name}</strong>
                <small>{genre.itemIds.length} transmissions</small>
              </span>
              <span aria-hidden="true">→</span>
            </>
          );
          return onSelectGenre ? (
            <button key={genre.slug} type="button" onClick={() => onSelectGenre(genre.slug)}>
              {content}
            </button>
          ) : (
            <Link key={genre.slug} to={`/genres?genre=${genre.slug}`}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

interface GenreCatalogueProps extends ListenerPrototypeContext {
  genres: ListenerGenreView[];
  items: CatalogueItem[];
}

export function GenreCatalogue({
  genres,
  items,
  selectedItemId,
  onPlay,
  onQueue,
  onSelect,
}: GenreCatalogueProps) {
  const [selectedGenreSlug, setSelectedGenreSlug] = useState(genres[0]!.slug);
  const selectedGenre = genres.find((genre) => genre.slug === selectedGenreSlug) ?? genres[0]!;
  const itemLookup = useMemo(() => itemsById(items), [items]);
  const genreItems = selectedGenre.itemIds.flatMap((id) => {
    const item = itemLookup.get(id);
    return item ? [item] : [];
  });

  return (
    <div className="genre-catalogue">
      <header className="genre-catalogue__intro">
        <div>
          <p className="eyebrow">Catalogue by sound</p>
          <h1>Genres</h1>
        </div>
        <p>Find a direction, then stay for the decisions inside it.</p>
      </header>
      <GenreRail genres={genres} items={items} onSelectGenre={setSelectedGenreSlug} />
      <section className="genre-focus" aria-live="polite">
        <div className="genre-focus__heading">
          <div>
            <p className="eyebrow">Selected genre</p>
            <h2>{selectedGenre.name}</h2>
          </div>
          <p>{selectedGenre.description}</p>
        </div>
        <CatalogueSection
          section={{
            id: `genre-${selectedGenre.slug}`,
            title: `${selectedGenre.name} transmissions`,
            icon: "✺",
            href: `/genres/${selectedGenre.slug}`,
            items: genreItems,
          }}
          selectedItemId={selectedItemId}
          onSelect={onSelect}
          onQueue={(item) => onQueue(item, `genre-${selectedGenre.slug}`)}
          onPlay={onPlay}
        />
      </section>
    </div>
  );
}
