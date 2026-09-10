import type {
  CatalogueItem,
  CatalogueLoadResult,
  CatalogueSection,
  PublicEditorialCollection,
} from "~/types/catalogue";

export const catalogueLoadingMessage = "Loading the catalogue…";

export interface CatalogueNavigationEntry {
  label: "Latest" | "Listen" | "Genres" | "Watch" | "Search" | "About";
  to:
    | "/#latest"
    | "/#audio"
    | "/#catalogue"
    | "/#genres"
    | "/#video"
    | "/genres"
    | "/search"
    | "/about";
}

export function isCatalogueNavigationEntryActive(
  entry: CatalogueNavigationEntry,
  pathname: string,
  hash: string,
  isFirstEntry: boolean,
): boolean {
  if (entry.to.startsWith("/#")) {
    return pathname === "/" && (hash === entry.to.slice(1) || (!hash && isFirstEntry));
  }

  return pathname === entry.to;
}

export function buildCatalogueNavigation(sections: CatalogueSection[]): CatalogueNavigationEntry[] {
  const sectionIds = new Set(sections.map((section) => section.id));
  const navigation: CatalogueNavigationEntry[] = [];

  if (sectionIds.has("latest")) {
    navigation.push({ label: "Latest", to: "/#latest" });
  }
  navigation.push({ label: "Listen", to: sectionIds.has("audio") ? "/#audio" : "/#catalogue" });
  if (sectionIds.has("video")) {
    navigation.push({ label: "Watch", to: "/#video" });
  }
  navigation.push({ label: "Search", to: "/search" }, { label: "About", to: "/about" });

  return navigation;
}

export const defaultCatalogueNavigation = buildCatalogueNavigation([]);

export function catalogueStateCopy(state: Exclude<CatalogueLoadResult, { status: "ready" }>): {
  heading: string;
  message: string;
} {
  return state.status === "empty"
    ? {
        heading: "No transmissions are published yet.",
        message: "The first listening selections will appear here when they are ready.",
      }
    : {
        heading: "Signal interrupted",
        message: state.message,
      };
}

export function buildCatalogueSections(
  items: CatalogueItem[],
  collections: PublicEditorialCollection[],
): CatalogueSection[] {
  if (collections.length === 0 && items.length > 0) {
    return [
      {
        id: "catalogue-fallback",
        title: "Catalogue",
        icon: "✺",
        href: "/#catalogue",
        items,
      },
    ];
  }

  return collections.map((collection) => ({
    id:
      collection.slug === "latest-transmissions"
        ? "latest"
        : collection.slug === "listen"
          ? "audio"
          : collection.slug === "watch"
            ? "video"
            : `collection-${collection.slug}`,
    title: collection.name,
    icon:
      collection.slug === "latest-transmissions"
        ? "✦"
        : collection.slug === "listen"
          ? "✺"
          : collection.slug === "watch"
            ? "✹"
            : "◆",
    href: `/collections/${collection.slug}`,
    items: collection.items,
  }));
}

export function findCatalogueItem(
  items: CatalogueItem[],
  itemId: string,
): CatalogueItem | undefined {
  return items.find((item) => item.id === itemId);
}
