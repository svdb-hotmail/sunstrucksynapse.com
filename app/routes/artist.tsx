import { Link, useOutletContext } from "react-router";
import { useState } from "react";

import { EntityTrackList } from "~/components/EntityTrackList";
import { IdentityPreviewControls } from "~/components/IdentityPreviewControls";
import { ShareButton } from "~/components/ShareButton";
import { ListenerIcon } from "~/design-system/ListenerIcon";
import { defaultIdentityTreatment, identityStyle } from "~/design-system/visual-identity";
import { SITE_NAME, SITE_URL } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { artistSeo } from "~/services/seo.server";
import { serializeJsonLd } from "~/utils/json-ld";
import type { PlayerOutletContext, PublicRelease } from "~/types/catalogue";

import type { Route } from "./+types/artist";

export async function loader({ context, params }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  const artist = await catalogueRepository.findPublishedArtist(params.artistSlug);
  if (!artist) {
    throw new Response("Artist not found.", { status: 404, statusText: "Artist not found" });
  }
  const seo = artistSeo(artist);
  const canonicalUrl = new URL(seo.canonicalPath, SITE_URL).href;
  const releaseSlugs = [...new Set(artist.tracks.map((track) => track.release.slug))];
  const releases = (
    await Promise.all(releaseSlugs.map((slug) => catalogueRepository.findPublishedRelease(slug)))
  ).filter((release): release is PublicRelease => release !== null);
  return { artist, releases, canonicalUrl, seo };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [{ title: `Artist not found | ${SITE_NAME}` }];
  }
  const data = loaderData;
  const description = data.artist.biography ?? `Listen to ${data.artist.name} on ${SITE_NAME}.`;
  return [
    { title: `${data.artist.name} | ${SITE_NAME}` },
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
  const { artist, releases, canonicalUrl } = loaderData;
  const [treatment, setTreatment] = useState(defaultIdentityTreatment(artist.slug));
  const previewArtists = [
    ...new Map(player.catalogue.items.map((track) => [track.creator.id, track.creator])).values(),
  ];

  return (
    <article
      className="entity-page identity-page artist-showcase"
      data-treatment={treatment}
      style={identityStyle(artist.slug)}
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
      <section className="identity-hero" aria-labelledby="artist-name">
        <div className="identity-hero__art">
          <img src={artist.artwork.src} alt={artist.artwork.alt} />
        </div>
        <div className="identity-hero__copy">
          <span className="identity-kicker">SUNSYN artist</span>
          <h1 id="artist-name">{artist.name}</h1>
          {artist.biography ? <p className="identity-description">{artist.biography}</p> : null}
          <p className="identity-count">
            {releases.length} {releases.length === 1 ? "release" : "releases"} ·{" "}
            {artist.tracks.length} {artist.tracks.length === 1 ? "track" : "tracks"}
          </p>
          <div className="identity-actions">
            <button
              type="button"
              disabled={!artist.tracks.some((track) => track.media) || !player.playSelection}
              onClick={() => player.playSelection?.(artist.tracks)}
            >
              <ListenerIcon name="play" /> Play artist
            </button>
            <ShareButton title={artist.name} url={canonicalUrl} />
          </div>
        </div>
      </section>
      {releases.length ? (
        <section className="identity-releases" aria-labelledby="artist-releases-title">
          <div className="identity-section-heading">
            <h2 id="artist-releases-title">Releases</h2>
            <Link to="/search">Explore SUNSYN</Link>
          </div>
          <div className="identity-release-grid">
            {releases.map((release) => (
              <Link className="identity-release-card" key={release.id} to={release.href}>
                <img src={release.artwork.src} alt="" loading="lazy" />
                <span>{release.title}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {artist.tracks.length ? (
        <section className="identity-tracks" aria-labelledby="artist-tracks-title">
          <div className="identity-section-heading">
            <h2 id="artist-tracks-title">Listen</h2>
            <Link to="/">Back to SUNSYN</Link>
          </div>
          <EntityTrackList tracks={artist.tracks} player={player} />
        </section>
      ) : null}
    </article>
  );
}
