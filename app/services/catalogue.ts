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
  items: CatalogueItem[],
  collections: PublicEditorialCollection[],
): CatalogueSection[] {
  const latest = collections.find((collection) => collection.slug === "latest-transmissions");

  return [
    {
      id: "latest",
      title: "Latest transmissions",
      icon: "✦",
      items: latest?.items ?? [],
    },
    {
      id: "audio",
      title: "Listen",
      icon: "✺",
      items: items.filter((item) => item.mediaKind === "audio"),
    },
    {
      id: "video",
      title: "Watch",
      icon: "✹",
      items: items.filter((item) => item.mediaKind === "video"),
    },
  ];
}

export function findCatalogueItem(
  items: CatalogueItem[],
  itemId: string,
): CatalogueItem | undefined {
  return items.find((item) => item.id === itemId);
}
