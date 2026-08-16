import { Link, useOutletContext } from "react-router";

import { ShareButton } from "~/components/ShareButton";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { trackSeo } from "~/services/seo.server";
import { serializeJsonLd } from "~/utils/json-ld";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/track";

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  const track = await catalogueRepository.findPublishedTrack(params.releaseSlug, params.trackSlug);
  if (!track) {
    throw new Response("Track not found.", { status: 404, statusText: "Track not found" });
  }
  const seo = trackSeo(track);
  const canonicalUrl = new URL(seo.canonicalPath, request.url).href;
  return { track, canonicalUrl, seo };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [{ title: "Track not found | Sunstruck Synapse Radio" }];
  }
  const data = loaderData;
  const { item } = data.track;
  const description = `Listen to ${item.description.title} by ${item.creator.name}.`;
  return [
    { title: `${item.description.title} | Sunstruck Synapse Radio` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: data.canonicalUrl },
    { property: "og:type", content: "music.song" },
    { property: "og:title", content: item.description.title },
    { property: "og:description", content: description },
    { property: "og:url", content: data.canonicalUrl },
    {
      property: "og:image",
      content: new URL(item.artwork.src, data.canonicalUrl).href,
    },
  ];
};

export default function TrackRoute({ loaderData }: Route.ComponentProps) {
  const player = useOutletContext<PlayerOutletContext>();
  const { item } = loaderData.track;

  return (
    <article className="entity-page track-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(loaderData.seo.jsonLd) }}
      />
      <p className="eyebrow">Track</p>
      <div className="entity-hero">
        <img src={item.artwork.src} alt={item.artwork.alt} />
        <div>
          <h1>{item.description.title}</h1>
          <p>
            <Link to={item.creator.href}>{item.creator.name}</Link>
            {" · "}
            <Link to={item.release.href}>{item.release.title}</Link>
          </p>
          <div className="entity-actions">
            <button type="button" onClick={() => player.playItem(item)} disabled={!item.media}>
              {item.media ? "Play in global player" : "Media unavailable"}
            </button>
            <button type="button" onClick={() => player.queueItem(item)} disabled={!item.media}>
              Add to queue
            </button>
            <ShareButton title={item.description.title} url={loaderData.canonicalUrl} />
          </div>
          {loaderData.track.reviewedDisclosureHref ? (
            <p>
              <Link to={loaderData.track.reviewedDisclosureHref}>Reviewed disclosure</Link>
            </p>
          ) : null}
        </div>
      </div>
      <Link to="/">Back to catalogue</Link>
    </article>
  );
}
