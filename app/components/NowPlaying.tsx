import type { CatalogueItem } from "~/types/catalogue";

interface NowPlayingProps {
  item: CatalogueItem;
}

export function NowPlaying({ item }: NowPlayingProps) {
  return (
    <>
      <p className="kicker">Now playing</p>
      <h1>
        {item.creator.name} - {item.description.title}
      </h1>
      <p className="subtitle">{item.description.subtitle}</p>
    </>
  );
}
