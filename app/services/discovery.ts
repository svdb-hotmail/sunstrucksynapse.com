import type { CatalogueItem } from "~/types/catalogue";

export interface DiscoveryFilters {
  query: string;
  genre: string;
  mood: string;
  year: number | null;
  process: string;
}

function includes(value: string, query: string): boolean {
  return value.toLocaleLowerCase().includes(query);
}

export function filterCatalogue(
  items: CatalogueItem[],
  filters: DiscoveryFilters,
): CatalogueItem[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const discovery = item.discovery;
    if (
      query &&
      ![item.description.title, item.creator.name, item.release.title].some((value) =>
        includes(value, query),
      )
    ) {
      return false;
    }
    if (filters.genre && discovery?.genre !== filters.genre) return false;
    if (filters.mood && !discovery?.moods.includes(filters.mood)) return false;
    if (filters.year && discovery?.year !== filters.year) return false;
    if (filters.process && !discovery?.creativeProcessTags.includes(filters.process)) {
      return false;
    }
    return true;
  });
}

export function discoveryOptions(items: CatalogueItem[]) {
  const strings = (values: Array<string | null | undefined>) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
  return {
    genres: strings(items.map((item) => item.discovery?.genre)),
    moods: strings(items.flatMap((item) => item.discovery?.moods ?? [])),
    years: [...new Set(items.flatMap((item) => item.discovery?.year ?? []))].sort((a, b) => b - a),
    processes: strings(items.flatMap((item) => item.discovery?.creativeProcessTags ?? [])),
  };
}
