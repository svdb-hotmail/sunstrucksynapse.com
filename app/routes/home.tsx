import { Link, useOutletContext } from "react-router";

import { EntityTrackList } from "~/components/EntityTrackList";
import { RadioStart } from "~/components/RadioStart";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { catalogueStateCopy } from "~/services/catalogue";
import { listeningSelection } from "~/services/listening";
import type { CatalogueLoadResult } from "~/types/catalogue";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/home";

export async function loader({ context }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  try {
    const items = await catalogueRepository.listPublishedTracks();
    const slugs = [...new Set(items.map((item) => item.release.slug))].slice(0, 4);
    const releases = await Promise.all(
      slugs.map((slug) => catalogueRepository.findPublishedRelease(slug, items)),
    );
    return { albums: releases.filter((release) => release !== null) };
  } catch {
    // Keep the root catalogue's existing unavailable/empty-state behavior.
    return { albums: [] };
  }
}

export const meta: Route.MetaFunction = () => [
  { title: SITE_NAME },
  {
    name: "description",
    content: SITE_DESCRIPTION,
  },
  { tagName: "link", rel: "canonical", href: SITE_URL },
  { property: "og:url", content: SITE_URL },
];

export default function Home({ loaderData }: Pick<Route.ComponentProps, "loaderData">) {
  const player = useOutletContext<PlayerOutletContext>();
  const { catalogue } = player;
  const { collection, tracks } = listeningSelection(catalogue.items, catalogue.collections);
  const previewTracks = [
    ...new Map([...tracks, ...catalogue.items].map((track) => [track.id, track])).values(),
  ].slice(0, 6);
  return (
    <div className="radio-home">
      <RadioStart
        tracks={tracks}
        collection={collection}
        onPlay={
          player.playSelection ? () => player.playSelection?.(tracks, collection?.id) : undefined
        }
      />
      <div className="radio-editorial-layout">
        <section id="catalogue" className="radio-tracks" aria-labelledby="radio-tracks-title">
          <div className="listener-section-heading">
            <div>
              <p className="eyebrow">The listening room</p>
              <h2 id="radio-tracks-title">In the collection</h2>
            </div>
            <Link to="/search">Explore all</Link>
          </div>
          {catalogue.status === "ready" ? (
            <EntityTrackList tracks={previewTracks} player={player} />
          ) : (
            <CatalogueState state={catalogue} />
          )}
        </section>
        <aside className="radio-editorial-note" aria-labelledby="radio-idea-title">
          <span className="radio-editorial-note__symbol" aria-hidden="true">
            ✦
          </span>
          <p className="eyebrow">The SunSyn idea</p>
          <h2 id="radio-idea-title">
            Tools make possibilities.
            <br />
            People make choices.
          </h2>
          <p>
            AI is part of the process. Human intention is the point. Every selection starts with
            listening.
          </p>
          <Link to="/about">
            Discover SunSyn <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </div>
      {catalogue.status === "ready" && loaderData.albums.length > 0 ? (
        <section className="album-shelf" aria-label="Published albums">
          <h2>Releases</h2>
          <div>
            {loaderData.albums.slice(0, 4).map((album) => (
              <Link key={album.id} to={album.href}>
                <img
                  src={album.artwork.src}
                  alt={album.artwork.alt}
                  width="160"
                  height="160"
                  loading="lazy"
                  decoding="async"
                />
                <strong>{album.title}</strong>
                <span>{album.artists.map((artist) => artist.name).join(", ")}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {catalogue.collections.length ? (
        <section className="radio-collections" aria-label="Editorial collections">
          <h2>Listening paths</h2>
          {catalogue.collections.slice(0, 4).map((entry) => (
            <Link key={entry.id} to={`/collections/${entry.slug}`}>
              {entry.name}
              <span>{entry.items.length} tracks</span>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}

export function CatalogueState({ state }: { state: CatalogueLoadResult }) {
  if (state.status === "ready") {
    return null;
  }
  const copy = catalogueStateCopy(state);

  return (
    <section className="catalogue-state" aria-live="polite">
      <p className="eyebrow">Catalogue</p>
      <h2>{copy.heading}</h2>
      <p>{copy.message}</p>
    </section>
  );
}
