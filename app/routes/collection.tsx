import { useEffect } from "react";
import { Link, useOutletContext } from "react-router";

import { EntityTrackList } from "~/components/EntityTrackList";
import { ShareButton } from "~/components/ShareButton";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { collectionSeo } from "~/services/seo.server";
import { serializeJsonLd } from "~/utils/json-ld";
import type { PlayerOutletContext } from "~/types/catalogue";
import { recordPlaybackEvent } from "~/services/analytics.client";

import type { Route } from "./+types/collection";

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  const collection = await catalogueRepository.findPublishedCollection(params.collectionSlug);
  if (!collection) {
    throw new Response("Collection not found.", {
      status: 404,
      statusText: "Collection not found",
    });
  }
  const seo = collectionSeo(collection);
  return {
    collection,
    canonicalUrl: new URL(seo.canonicalPath, request.url).href,
    seo,
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [{ title: "Collection not found | Sunstruck Synapse Radio" }];
  }
  return [
    { title: loaderData.seo.title },
    { name: "description", content: loaderData.seo.description },
    { tagName: "link", rel: "canonical", href: loaderData.canonicalUrl },
    { property: "og:type", content: "music.playlist" },
    { property: "og:title", content: loaderData.collection.name },
    { property: "og:description", content: loaderData.seo.description },
    { property: "og:url", content: loaderData.canonicalUrl },
  ];
};

export default function CollectionRoute({ loaderData }: Route.ComponentProps) {
  const player = useOutletContext<PlayerOutletContext>();
  const { collection, canonicalUrl, seo } = loaderData;
  useEffect(() => {
    recordPlaybackEvent("collection_view", { collectionId: collection.id });
  }, [collection.id]);

  return (
    <article className="entity-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(seo.jsonLd) }}
      />
      <p className="eyebrow">Editorial collection</p>
      <div className="entity-heading">
        <div>
          <h1>{collection.name}</h1>
          {collection.description ? <p>{collection.description}</p> : null}
        </div>
        <ShareButton title={collection.name} url={canonicalUrl} collectionId={collection.id} />
      </div>
      <EntityTrackList tracks={collection.items} player={player} />
      <Link to="/">Back to catalogue</Link>
    </article>
  );
}
