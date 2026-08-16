export type MediaKind = "audio" | "video";

export interface Creator {
  id: string;
  name: string;
  role: string;
}

export interface Artwork {
  src: string;
  alt: string;
  playerSrc?: string;
}

export interface DescriptiveText {
  title: string;
  subtitle: string;
}

export interface MediaSource<Kind extends MediaKind> {
  src: string;
  mimeType: `${Kind}/${string}`;
  poster?: Kind extends "video" ? string : never;
}

interface CatalogueItemBase {
  id: string;
  creator: Creator;
  artwork: Artwork;
  description: DescriptiveText;
}

export type CatalogueItem = CatalogueItemBase &
  (
    | { mediaKind: "audio"; media?: MediaSource<"audio"> }
    | { mediaKind: "video"; media?: MediaSource<"video"> }
  );

export interface CatalogueSection {
  id: "latest" | "audio" | "video";
  title: string;
  icon: string;
  items: CatalogueItem[];
}

export interface PlayerState {
  selectedItemId: CatalogueItem["id"];
}

export interface QueueEntry {
  itemId: CatalogueItem["id"];
  title: string;
  subtitle: string;
}

export interface Offering {
  id: string;
  number: string;
  title: string;
  description: string;
}

export interface PlayerOutletContext {
  selectedItemId: CatalogueItem["id"];
  selectItem: (item: CatalogueItem) => void;
  queueItem: (item: CatalogueItem) => void;
  playItem: (item: CatalogueItem) => void;
}
