import {
  catalogueViews,
  type CatalogueQuery,
  type CuratorCataloguePage,
  type CuratorCatalogueTrack,
} from "~/types/curator-catalogue";

// Synthetic Storybook/explicit test-mode records, never a production fallback.
export const catalogueTrackFixtures: CuratorCatalogueTrack[] = [
  ["Incomplete signal", "attention"],
  ["First light", "ready"],
  ["Quiet machines", "preparing"],
  ["Afterlight", "scheduled"],
  ["Open frequency", "live"],
  ["Old signal", "archived"],
].map(([title, state], index) => ({
  id: `d0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  releaseId: `e0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  title,
  slug: title.toLowerCase().replaceAll(" ", "-"),
  releaseSlug: `example-release-${index}`,
  releaseTitle: title,
  artistName: "Synthetic Artist",
  state: state as CuratorCatalogueTrack["state"],
  lifecycleStatus:
    state === "live"
      ? "published"
      : state === "scheduled"
        ? "scheduled"
        : state === "archived"
          ? "archived"
          : "draft",
  releaseStatus: state === "live" || index === 0 ? "published" : "draft",
  artistStatuses: ["published"],
  publiclyListed: state === "live",
  publicMediaReady: state !== "preparing",
  coverReady: true,
  blockers: state === "preparing" ? ["verified automatic streaming preparation"] : [],
  submissionId: null,
  preparationStatus: state === "preparing" ? "processing" : "ready",
  failureCode: null,
  scheduledFor: state === "scheduled" ? "2030-10-18T16:00:00.000Z" : null,
  previewUrl: null,
  releaseTrackCount: 1,
  updatedAt: "2026-10-16T12:00:00.000Z",
}));

export function fixtureCataloguePage(query: CatalogueQuery): CuratorCataloguePage {
  const filtered = catalogueTrackFixtures.filter((t) =>
    `${t.title} ${t.artistName} ${t.releaseTitle}`
      .toLowerCase()
      .includes(query.query.toLowerCase()),
  );
  const counts = Object.fromEntries(
    catalogueViews.map((view) => [
      view,
      filtered.filter((t) => view === "all" || t.state === view).length,
    ]),
  ) as CuratorCataloguePage["counts"];
  const view = query.view ?? (counts.attention ? "attention" : "all");
  const items = filtered
    .filter((t) => view === "all" || t.state === view)
    .sort(
      (a, b) =>
        a.title.toLowerCase().localeCompare(b.title.toLowerCase()) || a.id.localeCompare(b.id),
    )
    .filter(
      (t) =>
        !query.after ||
        t.title.toLowerCase() > query.after.title.toLowerCase() ||
        (t.title.toLowerCase() === query.after.title.toLowerCase() && t.id > query.after.id),
    );
  return {
    items,
    counts,
    view,
    next: null,
    selected: catalogueTrackFixtures.find((t) => t.id === query.trackId) ?? null,
    history: [],
    observedAt: "2026-10-16T12:00:00.000Z",
  };
}
