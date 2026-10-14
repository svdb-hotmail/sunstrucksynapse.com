import { Link, useOutletContext } from "react-router";

import { CatalogueSection } from "~/components/CatalogueSection";
import { Intro } from "~/components/Intro";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { buildCatalogueSections, catalogueStateCopy } from "~/services/catalogue";
import type { CatalogueLoadResult } from "~/types/catalogue";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/home";

export async function loader({ context }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  try {
    const items = await catalogueRepository.listPublishedTracks();
    const slugs = [...new Set(items.map((item) => item.release.slug))];
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
  const { selectedItemId, catalogue, selectItem, queueItem, playItem } =
    useOutletContext<PlayerOutletContext>();
  const catalogueSections = buildCatalogueSections(catalogue.items, catalogue.collections);

  return (
    <>
      <Intro />
      {catalogue.status === "ready" && loaderData.albums.length > 0 ? (
        <section className="album-shelf" aria-label="Published albums">
          <h2>Albums & releases</h2>
          <div>
            {loaderData.albums.map((album) => (
              <Link key={album.id} to={album.href}>
                <img src={album.artwork.src} alt={album.artwork.alt} />
                <strong>{album.title}</strong>
                <span>{album.artists.map((artist) => artist.name).join(", ")}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <div id="catalogue" className="catalogue-anchor">
        {catalogue.status === "ready" ? (
          catalogueSections.map((section) => (
            <CatalogueSection
              section={section}
              selectedItemId={selectedItemId}
              onSelect={selectItem}
              onQueue={queueItem}
              onPlay={playItem}
              key={section.id}
            />
          ))
        ) : (
          <CatalogueState state={catalogue} />
        )}
      </div>
    </>
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
