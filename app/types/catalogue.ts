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

export interface CatalogueItem {
  id: string;
  creator: Creator;
  mediaKind: MediaKind;
  artwork: Artwork;
  description: DescriptiveText;
}

export interface CatalogueSection {
  id: "latest" | "audio" | "video";
  title: string;
  icon: string;
  items: CatalogueItem[];
}

export interface PlayerState {
  selectedItemId: CatalogueItem["id"];
  mode: MediaKind;
}

export interface QueueEntry {
  id: string;
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
}
