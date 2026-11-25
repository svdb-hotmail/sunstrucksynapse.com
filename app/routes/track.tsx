import { Link, useOutletContext } from "react-router";

import { ShareButton } from "~/components/ShareButton";
import { SITE_NAME, SITE_URL } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import {
  SHARE_PREVIEW_SIZE,
  SHARE_PREVIEW_TYPE,
  trackSharePreview,
} from "~/services/track-share-preview";
import { trackSeo } from "~/services/seo.server";
import { serializeJsonLd } from "~/utils/json-ld";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/track";

export async function loader({ context, params }: Route.LoaderArgs) {
  const { catalogueRepository, env } = context.get(cloudflareContext);
  const track = await catalogueRepository.findPublishedTrack(params.releaseSlug, params.trackSlug);
  if (!track) {
    throw new Response("Track not found.", { status: 404, statusText: "Track not found" });
  }
  const seo = trackSeo(track);
  const canonicalUrl = new URL(seo.canonicalPath, SITE_URL).href;
  const preview = env && (await trackSharePreview(track.item));
  const object = preview ? await env?.MEDIA_BUCKET.head(preview.key).catch(() => null) : null;
  const shareVideo =
    preview && object?.size && object.httpMetadata?.contentType === SHARE_PREVIEW_TYPE
      ? { url: new URL(preview.path, canonicalUrl).href, poster: preview.artworkUrl }
      : null;
  return { track, canonicalUrl, seo, shareVideo };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [{ title: `Track not found | ${SITE_NAME}` }];
  }
  const data = loaderData;
  const { item } = data.track;
  const description = `Listen to ${item.description.title} by ${item.creator.name}.`;
  return [
    { title: `${item.description.title} | ${SITE_NAME}` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: data.canonicalUrl },
    { property: "og:type", content: data.shareVideo ? "video.other" : "music.song" },
    { property: "og:title", content: item.description.title },
    { property: "og:description", content: description },
    { property: "og:url", content: data.canonicalUrl },
    {
      property: "og:image",
      content: data.shareVideo?.poster ?? new URL(item.artwork.src, data.canonicalUrl).href,
    },
    ...(data.shareVideo
      ? [
          { property: "og:video", content: data.shareVideo.url },
          { property: "og:video:type", content: SHARE_PREVIEW_TYPE },
          { property: "og:video:width", content: String(SHARE_PREVIEW_SIZE) },
          { property: "og:video:height", content: String(SHARE_PREVIEW_SIZE) },
        ]
      : []),
  ];
};

export default function TrackRoute({ loaderData }: Route.ComponentProps) {
  const player = useOutletContext<PlayerOutletContext>();
  const { item, release } = loaderData.track;

  return (
    <article className="entity-page track-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(loaderData.seo.jsonLd) }}
      />
      <p className="eyebrow">Track</p>
      <div className="entity-hero">
        <img
          src={item.artwork.src}
          alt={item.artwork.alt}
          width="96"
          height="96"
          decoding="async"
        />
        <div>
          <h1>{item.description.title}</h1>
          <p>
            <Link to={item.creator.href}>{item.creator.name}</Link>
            {" · "}
            <Link to={item.release.href}>{item.release.title}</Link>
          </p>
          <div className="entity-actions">
            <button type="button" onClick={() => player.playItem(item)} disabled={!item.media}>
              {item.media
                ? player.playingItemId === item.id
                  ? "Pause track"
                  : "Play track"
                : "Media unavailable"}
            </button>
            <button type="button" onClick={() => player.queueItem(item)} disabled={!item.media}>
              Add to queue
            </button>
            <ShareButton
              title={item.description.title}
              url={loaderData.canonicalUrl}
              trackId={item.id}
            />
          </div>
          {loaderData.track.reviewedDisclosureHref ? (
            <p>
              <Link to={loaderData.track.reviewedDisclosureHref}>Reviewed disclosure</Link>
            </p>
          ) : null}
        </div>
      </div>
      {release.tracks.length > 1 ? (
        <section className="track-release" aria-labelledby="track-release-title">
          <p className="eyebrow">From this release</p>
          <div className="track-release__card">
            <Link to={release.href} aria-label={`View ${release.title}`}>
              <img src={release.artwork.src} alt="" loading="lazy" />
            </Link>
            <div>
              <h2 id="track-release-title">
                <Link to={release.href}>{release.title}</Link>
              </h2>
              <p>
                {release.artists.map((artist) => artist.name).join(", ")} · {release.tracks.length}{" "}
                tracks
              </p>
              <Link className="track-release__link" to={release.href}>
                Explore release →
              </Link>
            </div>
          </div>
        </section>
      ) : null}
      <Link to="/">Back to catalogue</Link>
    </article>
  );
}
