import type { CatalogueItem } from "~/types/catalogue";

interface NowPlayingProps {
  item: CatalogueItem;
}

export function NowPlaying({ item }: NowPlayingProps) {
  return (
    <>
      <p className="kicker">Featured transmission</p>
      <h1 aria-label={`${item.creator.name} featured transmission`}>{item.creator.name}</h1>
      <p className="transmission-provenance">
        Human-curated <span aria-hidden="true">•</span> <strong>AI-assisted music</strong>
      </p>
      <p className="subtitle">{item.description.title}</p>
    </>
  );
}
