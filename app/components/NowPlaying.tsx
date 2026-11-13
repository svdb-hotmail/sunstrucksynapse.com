import type { CatalogueItem } from "~/types/catalogue";

interface NowPlayingProps {
  item: CatalogueItem;
}

export function NowPlaying({ item }: NowPlayingProps) {
  return (
    <>
      <p className="kicker">Featured transmission</p>
      <p className="subtitle">{item.description.title}</p>
    </>
  );
}
