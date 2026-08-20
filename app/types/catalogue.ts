export type MediaKind = "audio" | "video";

export interface Creator {
  id: string;
  slug: string;
  name: string;
  role: string;
  href: string;
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
  slug: string;
  creator: Creator;
  release: {
    id: string;
    slug: string;
    title: string;
    href: string;
  };
  href: string;
  artwork: Artwork;
  description: DescriptiveText;
  discovery?: {
    genre: string | null;
    moods: string[];
    year: number | null;
    creativeProcessTags: string[];
  };
}

export type CatalogueItem = CatalogueItemBase &
  (
    | { mediaKind: "audio"; media?: MediaSource<"audio"> }
    | { mediaKind: "video"; media?: MediaSource<"video"> }
  );

export interface CatalogueSection {
  id: string;
  title: string;
  icon: string;
  href: string;
  items: CatalogueItem[];
}

export interface PublicEditorialCollection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  artwork?: Artwork;
  items: CatalogueItem[];
}

export interface PlayerState {
  selectedItemId: CatalogueItem["id"] | null;
}

export interface QueueEntry {
  itemId: CatalogueItem["id"];
  title: string;
  subtitle: string;
  collectionId?: string;
}

export interface Offering {
  id: string;
  number: string;
  title: string;
  description: string;
}

export interface PlayerOutletContext {
  selectedItemId: CatalogueItem["id"] | null;
  catalogue: CatalogueLoadResult;
  selectItem: (item: CatalogueItem) => void;
  queueItem: (item: CatalogueItem, collectionId?: string) => void;
  playItem: (item: CatalogueItem, collectionId?: string) => void;
}

export interface PublicArtist {
  id: string;
  slug: string;
  name: string;
  biography: string | null;
  href: string;
  artwork: Artwork;
  tracks: CatalogueItem[];
}

export interface PublicRelease {
  id: string;
  slug: string;
  title: string;
  releaseDate: string | null;
  href: string;
  artwork: Artwork;
  artists: Creator[];
  tracks: CatalogueItem[];
}

export interface PublicTrack {
  item: CatalogueItem;
  artist: PublicArtist;
  release: PublicRelease;
  reviewedDisclosureHref?: string;
}

export type CatalogueLoadResult =
  | { status: "ready"; items: CatalogueItem[]; collections: PublicEditorialCollection[] }
  | { status: "empty"; items: []; collections: [] }
  | { status: "error"; items: []; collections: []; message: string };
