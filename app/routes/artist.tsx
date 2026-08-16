import { Link, useOutletContext } from "react-router";

import { EntityTrackList } from "~/components/EntityTrackList";
import { ShareButton } from "~/components/ShareButton";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { artistSeo } from "~/services/seo.server";
import { serializeJsonLd } from "~/utils/json-ld";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/artist";

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  const artist = await catalogueRepository.findPublishedArtist(params.artistSlug);
  if (!artist) {
    throw new Response("Artist not found.", { status: 404, statusText: "Artist not found" });
  }
  const seo = artistSeo(artist);
  const canonicalUrl = new URL(seo.canonicalPath, request.url).href;
  return { artist, canonicalUrl, seo };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [{ title: "Artist not found | Sunstruck Synapse Radio" }];
  }
  const data = loaderData;
  const description =
    data.artist.biography ?? `Listen to ${data.artist.name} on Sunstruck Synapse Radio.`;
  return [
    { title: `${data.artist.name} | Sunstruck Synapse Radio` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: data.canonicalUrl },
    { property: "og:type", content: "profile" },
    { property: "og:title", content: data.artist.name },
    { property: "og:description", content: description },
    { property: "og:url", content: data.canonicalUrl },
    {
      property: "og:image",
      content: new URL(data.artist.artwork.src, data.canonicalUrl).href,
    },
  ];
};

export default function ArtistRoute({ loaderData }: Route.ComponentProps) {
  const player = useOutletContext<PlayerOutletContext>();
  const { artist, canonicalUrl } = loaderData;

  return (
    <article className="entity-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(loaderData.seo.jsonLd) }}
      />
      <p className="eyebrow">Artist</p>
      <div className="entity-hero">
        <img src={artist.artwork.src} alt={artist.artwork.alt} />
        <div>
          <h1>{artist.name}</h1>
          <p>{artist.biography ?? "Listen to the published transmissions from this artist."}</p>
          <ShareButton title={artist.name} url={canonicalUrl} />
        </div>
      </div>
      <div className="entity-heading">
        <h2>Published tracks</h2>
        <Link to="/">Back to catalogue</Link>
      </div>
      <EntityTrackList tracks={artist.tracks} player={player} />
    </article>
  );
}
