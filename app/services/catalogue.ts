import type {
  CatalogueItem,
  CatalogueLoadResult,
  CatalogueSection,
  PublicEditorialCollection,
} from "~/types/catalogue";

export const catalogueLoadingMessage = "Loading the catalogue…";

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
  _items: CatalogueItem[],
  collections: PublicEditorialCollection[],
): CatalogueSection[] {
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
