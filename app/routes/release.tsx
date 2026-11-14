import { Link, useOutletContext } from "react-router";
import { useState } from "react";

import { EntityTrackList } from "~/components/EntityTrackList";
import { IdentityPreviewControls } from "~/components/IdentityPreviewControls";
import { ShareButton } from "~/components/ShareButton";
import { ListenerIcon } from "~/design-system/ListenerIcon";
import { defaultIdentityTreatment, identityStyle } from "~/design-system/visual-identity";
import { SITE_NAME, SITE_URL } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { releaseSeo } from "~/services/seo.server";
import { serializeJsonLd } from "~/utils/json-ld";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/release";

export async function loader({ context, params }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  const release = await catalogueRepository.findPublishedRelease(params.releaseSlug);
  if (!release) {
    throw new Response("Release not found.", { status: 404, statusText: "Release not found" });
  }
  const seo = releaseSeo(release);
  const canonicalUrl = new URL(seo.canonicalPath, SITE_URL).href;
  return { release, canonicalUrl, seo };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [{ title: `Release not found | ${SITE_NAME}` }];
  }
  const data = loaderData;
  const artistNames = data.release.artists.map((artist) => artist.name).join(", ");
  const description = `Listen to ${data.release.title} by ${artistNames}.`;
  return [
    { title: `${data.release.title} | ${SITE_NAME}` },
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
  const [treatment, setTreatment] = useState(defaultIdentityTreatment(release.slug));
  const previewArtists = [
    ...new Map(player.catalogue.items.map((track) => [track.creator.id, track.creator])).values(),
  ];

  return (
    <article
      className="entity-page identity-page release-showcase"
      data-treatment={treatment}
      style={identityStyle(release.slug)}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(loaderData.seo.jsonLd) }}
      />
      <IdentityPreviewControls
        treatment={treatment}
        onChange={setTreatment}
        artists={previewArtists}
      />
      <section className="identity-hero" aria-labelledby="release-title">
        <div className="identity-hero__art">
          <img src={release.artwork.src} alt={release.artwork.alt} />
        </div>
        <div className="identity-hero__copy">
          <span className="identity-kicker">SUNSYN release</span>
          <h1 id="release-title">{release.title}</h1>
          <p className="identity-byline">
            By{" "}
            {release.artists.map((artist, index) => (
              <span key={artist.id}>
                {index > 0 ? ", " : null}
                <Link to={artist.href}>{artist.name}</Link>
              </span>
            ))}
          </p>
          {release.description ? (
            <p className="identity-description">{release.description}</p>
          ) : null}
          <div className="identity-actions">
            <button
              type="button"
              disabled={!release.tracks.some((t) => t.media)}
              onClick={() => player.playAlbum?.(release.tracks)}
            >
              <ListenerIcon name="play" /> Play release
            </button>
            <button
              type="button"
              disabled={!release.tracks.some((t) => t.media)}
              onClick={() => player.queueAlbum?.(release.tracks)}
            >
              Add to queue
            </button>
            <ShareButton title={release.title} url={canonicalUrl} />
          </div>
          <p className="identity-count">
            {release.tracks.length} {release.tracks.length === 1 ? "track" : "tracks"}
            {release.releaseDate ? ` · ${new Date(release.releaseDate).getUTCFullYear()}` : ""}
          </p>
        </div>
      </section>
      <section className="identity-tracks" aria-labelledby="release-tracks-title">
        <div className="identity-section-heading">
          <h2 id="release-tracks-title">Track list</h2>
          <Link to="/">Back to SUNSYN</Link>
        </div>
        <EntityTrackList tracks={release.tracks} player={player} />
      </section>
    </article>
  );
}
