import { useEffect } from "react";
import { data, Form, Link, useOutletContext } from "react-router";

import { EntityTrackList } from "~/components/EntityTrackList";
import { DiscoveryFacet } from "~/components/DiscoveryFacet";
import { SITE_NAME } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { discoveryOptions, filterCatalogue, type DiscoveryFilters } from "~/services/discovery";
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
  const filters = readFilters(new URL(request.url));
  const results = filterCatalogue(items, filters);
  return data(
    { filters, results, options: discoveryOptions(items) },
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
  const { filters, results, options } = loaderData;
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
  return (
    <section className="entity-page listener-explore">
      <p className="eyebrow">Choose your next listen</p>
      <h1>Explore</h1>
      <Form
        key={`${filters.query}|${filters.genre}|${filters.mood}|${filters.year ?? ""}|${filters.process}`}
        method="get"
        preventScrollReset
        className="listener-search"
      >
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
          <Link to="/search" preventScrollReset>
            Clear search & filters
          </Link>
        ) : null}
      </Form>
      <p role="status">
        {results.length
          ? `${results.length} matching ${results.length === 1 ? "track" : "tracks"}.`
          : "No matching tracks. Clear a filter or try an artist, release, or track title."}
      </p>
      {results.length ? <EntityTrackList tracks={results} player={player} /> : null}
    </section>
  );
}
