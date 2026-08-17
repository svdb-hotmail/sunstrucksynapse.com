import { useEffect } from "react";
import { data, Form, Link, useOutletContext } from "react-router";

import { EntityTrackList } from "~/components/EntityTrackList";
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
  return (
    <section className="entity-page">
      <p className="eyebrow">Catalogue discovery</p>
      <h1>Search the collection</h1>
      <Form
        key={`${filters.query}|${filters.genre}|${filters.mood}|${filters.year ?? ""}|${filters.process}`}
        method="get"
        className="curator-form"
      >
        <label>
          Search artists, releases and tracks
          <input name="q" defaultValue={filters.query} type="search" />
        </label>
        <label>
          Genre
          <select name="genre" defaultValue={filters.genre}>
            <option value="">All genres</option>
            {options.genres.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Mood
          <select name="mood" defaultValue={filters.mood}>
            <option value="">All moods</option>
            {options.moods.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Year
          <select name="year" defaultValue={filters.year ?? ""}>
            <option value="">All years</option>
            {options.years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Creative process
          <select name="process" defaultValue={filters.process}>
            <option value="">All processes</option>
            {options.processes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button type="submit">Search</button>
        {active ? <Link to="/search">Clear filters</Link> : null}
      </Form>
      <p aria-live="polite">
        {results.length
          ? `${results.length} matching ${results.length === 1 ? "track" : "tracks"}.`
          : "No matching tracks. Clear a filter or try an artist, release, or track title."}
      </p>
      {results.length ? <EntityTrackList tracks={results} player={player} /> : null}
    </section>
  );
}
