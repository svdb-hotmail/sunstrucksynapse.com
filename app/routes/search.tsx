import { useEffect } from "react";
import { data, Form, Link, useOutletContext } from "react-router";

import { CatalogueCard } from "~/components/CatalogueCard";
import { DiscoveryFacet } from "~/components/DiscoveryFacet";
import { SITE_NAME } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import {
  discoveryOptions,
  EXPLORE_VIEWS,
  exploreItems,
  filterCatalogue,
  type DiscoveryFilters,
  type ExploreView,
} from "~/services/discovery";
import type { PlayerOutletContext } from "~/types/catalogue";
import { recordPlaybackEvent } from "~/services/analytics.client";

import type { Route } from "./+types/search";

function readFilters(url: URL): DiscoveryFilters {
  const year = Number(url.searchParams.get("year"));
  return {
    query: url.searchParams.get("q")?.trim() ?? "",
    genre: url.searchParams.get("genre") ?? "",
    mood: url.searchParams.get("mood") ?? "",
    year: Number.isSafeInteger(year) && year > 0 ? year : null,
    process: url.searchParams.get("process") ?? "",
  };
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const startedAt = performance.now();
  const items = await context.get(cloudflareContext).catalogueRepository.listPublishedTracks();
  const url = new URL(request.url);
  const filters = readFilters(url);
  const requestedView = url.searchParams.get("view");
  const hasFilters = Boolean(
    filters.query || filters.genre || filters.mood || filters.year || filters.process,
  );
  const view: ExploreView =
    EXPLORE_VIEWS.find((entry) => entry === requestedView) ?? (hasFilters ? "latest" : "featured");
  // Match the deliberately selected homepage release. The repository already supplies Latest in release-date order.
  const featuredReleaseId =
    items.find((item) => item.release.slug === "phase-zero-transmissions")?.release.id ??
    items[0]?.release.id;
  const matches = exploreItems(filterCatalogue(items, filters), view, featuredReleaseId);
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const requestedPage = Number(url.searchParams.get("page"));
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const results = matches.slice((page - 1) * pageSize, page * pageSize);
  return data(
    {
      filters,
      view,
      page,
      pageCount,
      total: matches.length,
      results,
      options: discoveryOptions(items),
    },
    {
      headers: {
        "Server-Timing": `discovery;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    },
  );
}

export const meta = () => [{ title: `Search | ${SITE_NAME}` }];

export default function SearchRoute({ loaderData }: Route.ComponentProps) {
  const player = useOutletContext<PlayerOutletContext>();
  const { filters, view, page, pageCount, total, results, options } = loaderData;
  const active = Boolean(
    filters.query || filters.genre || filters.mood || filters.year || filters.process,
  );
  useEffect(() => {
    for (const item of results) {
      recordPlaybackEvent("catalogue_impression", { trackId: item.id });
    }
  }, [results]);
  const activeCount = [filters.genre, filters.mood, filters.year, filters.process].filter(
    Boolean,
  ).length;
  const hrefFor = (nextView: ExploreView, nextPage?: number) => {
    const query = new URLSearchParams();
    if (filters.query) query.set("q", filters.query);
    if (filters.genre) query.set("genre", filters.genre);
    if (filters.mood) query.set("mood", filters.mood);
    if (filters.year) query.set("year", String(filters.year));
    if (filters.process) query.set("process", filters.process);
    query.set("view", nextView);
    if (nextPage && nextPage > 1) query.set("page", String(nextPage));
    return `/search?${query}`;
  };
  return (
    <section className="entity-page listener-explore">
      <p className="eyebrow">Discover the catalogue</p>
      <h1>Explore</h1>
      <nav className="explore-tabs" aria-label="Explore views">
        {EXPLORE_VIEWS.map((entry) => (
          <Link key={entry} to={hrefFor(entry)} aria-current={entry === view ? "page" : undefined}>
            {entry}
          </Link>
        ))}
      </nav>
      <Form
        key={`${filters.query}|${filters.genre}|${filters.mood}|${filters.year ?? ""}|${filters.process}`}
        method="get"
        preventScrollReset
        className="listener-search"
      >
        <input type="hidden" name="view" value={view} />
        <label htmlFor="listener-query">Search artists, releases and tracks</label>
        <div className="listener-search__query">
          <input id="listener-query" name="q" defaultValue={filters.query} type="search" />
          <button type="submit">Search</button>
        </div>
        <details className="listener-filters">
          <summary role="button">Filters{activeCount ? ` (${activeCount} applied)` : ""}</summary>
          <div className="listener-filters__fields">
            {options.genres.length || filters.genre ? (
              <DiscoveryFacet
                name="genre"
                label="Genre"
                allLabel="All genres"
                options={options.genres}
                selectedValue={filters.genre}
              />
            ) : null}
            {options.moods.length || filters.mood ? (
              <DiscoveryFacet
                name="mood"
                label="Mood"
                allLabel="All moods"
                options={options.moods}
                selectedValue={filters.mood}
              />
            ) : null}
            {options.years.length || filters.year ? (
              <DiscoveryFacet
                name="year"
                label="Year"
                allLabel="All years"
                options={options.years}
                selectedValue={filters.year}
              />
            ) : null}
            {options.processes.length || filters.process ? (
              <DiscoveryFacet
                name="process"
                label="Creative process"
                allLabel="All processes"
                options={options.processes}
                selectedValue={filters.process}
              />
            ) : null}
            <button type="submit">Apply filters</button>
          </div>
        </details>
        {active ? (
          <Link to={`/search?view=${view}`} preventScrollReset>
            Clear search & filters
          </Link>
        ) : null}
      </Form>
      <p className="explore-count" role="status">
        {total
          ? `${total} ${total === 1 ? "track" : "tracks"}${pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}`
          : active
            ? "No tracks match here. Clear a filter or choose another view."
            : "No tracks in this view yet. Choose another view."}
      </p>
      {results.length ? (
        <ol className="explore-grid" data-view={view}>
          {results.map((item) => (
            <li key={item.id}>
              <CatalogueCard
                item={item}
                explore
                isSelected={player.selectedItemId === item.id}
                isPlaying={player.playingItemId === item.id}
                isQueued={
                  player.queuedItemIds?.includes(item.id) || player.selectedItemId === item.id
                }
                onPlay={() => player.playItem(item)}
                onQueue={() => player.queueItem(item)}
              />
            </li>
          ))}
        </ol>
      ) : null}
      {pageCount > 1 ? (
        <nav className="explore-pages" aria-label="Explore pages">
          {page > 1 ? <Link to={hrefFor(view, page - 1)}>Previous</Link> : <span />}
          <span>
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? <Link to={hrefFor(view, page + 1)}>Next</Link> : <span />}
        </nav>
      ) : null}
    </section>
  );
}
