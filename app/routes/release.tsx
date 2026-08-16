import { Link, useOutletContext } from "react-router";

import { EntityTrackList } from "~/components/EntityTrackList";
import { ShareButton } from "~/components/ShareButton";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { releaseSeo } from "~/services/seo.server";
import { serializeJsonLd } from "~/utils/json-ld";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/release";

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  const release = await catalogueRepository.findPublishedRelease(params.releaseSlug);
  if (!release) {
    throw new Response("Release not found.", { status: 404, statusText: "Release not found" });
  }
  const seo = releaseSeo(release);
  const canonicalUrl = new URL(seo.canonicalPath, request.url).href;
  return { release, canonicalUrl, seo };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [{ title: "Release not found | Sunstruck Synapse Radio" }];
  }
  const data = loaderData;
  const artistNames = data.release.artists.map((artist) => artist.name).join(", ");
  const description = `Listen to ${data.release.title} by ${artistNames}.`;
  return [
    { title: `${data.release.title} | Sunstruck Synapse Radio` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: data.canonicalUrl },
    { property: "og:type", content: "music.album" },
    { property: "og:title", content: data.release.title },
    { property: "og:description", content: description },
    { property: "og:url", content: data.canonicalUrl },
    {
      property: "og:image",
      content: new URL(data.release.artwork.src, data.canonicalUrl).href,
    },
  ];
};

export default function ReleaseRoute({ loaderData }: Route.ComponentProps) {
  const player = useOutletContext<PlayerOutletContext>();
  const { release, canonicalUrl } = loaderData;

  return (
    <article className="entity-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(loaderData.seo.jsonLd) }}
      />
      <p className="eyebrow">Release</p>
      <div className="entity-hero">
        <img src={release.artwork.src} alt={release.artwork.alt} />
        <div>
          <h1>{release.title}</h1>
          <p>
            By{" "}
            {release.artists.map((artist, index) => (
              <span key={artist.id}>
                {index > 0 ? ", " : null}
                <Link to={artist.href}>{artist.name}</Link>
              </span>
            ))}
          </p>
          <ShareButton title={release.title} url={canonicalUrl} />
        </div>
      </div>
      <div className="entity-heading">
        <h2>Track list</h2>
        <Link to="/">Back to catalogue</Link>
      </div>
      <EntityTrackList tracks={release.tracks} player={player} />
    </article>
  );
}
