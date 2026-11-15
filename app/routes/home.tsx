import { Link, useOutletContext } from "react-router";
import { useEffect, useRef, useState } from "react";

import { ListenerIcon } from "~/design-system/ListenerIcon";
import { trackLabel } from "~/design-system/track-label";
import { Artwork } from "~/design-system/Artwork";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/brand";
import { catalogueStateCopy } from "~/services/catalogue";
import { listeningSelection } from "~/services/listening";
import { identityStyle } from "~/design-system/visual-identity";
import type { CatalogueLoadResult } from "~/types/catalogue";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: SITE_NAME },
  {
    name: "description",
    content: SITE_DESCRIPTION,
  },
  { tagName: "link", rel: "canonical", href: SITE_URL },
  { property: "og:url", content: SITE_URL },
];

export default function Home() {
  const player = useOutletContext<PlayerOutletContext>();
  const { catalogue } = player;
  const { collection } = listeningSelection(catalogue.items, catalogue.collections);
  const featuredTracks = catalogue.items
    .filter((item) => item.mediaKind === "audio" && item.media)
    .sort(
      (a, b) =>
        Number(b.release.slug === "phase-zero-transmissions") -
          Number(a.release.slug === "phase-zero-transmissions") ||
        a.release.title.localeCompare(b.release.title),
    );
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [advanceCount, setAdvanceCount] = useState(0);
  const featureRef = useRef<HTMLElement>(null);
  const featured = featuredTracks[featuredIndex % featuredTracks.length];
  useEffect(() => {
    if (
      !advanceCount ||
      !featureRef.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const skin = document.documentElement.dataset.skin;
    const frames: Keyframe[] =
      skin === "underground"
        ? [
            { clipPath: "inset(0 100% 0 0)", opacity: 0.5 },
            { clipPath: "inset(0 0 0 0)", opacity: 1 },
          ]
        : skin === "synth"
          ? [
              { opacity: 0, transform: "scale(0.96)" },
              { opacity: 1, transform: "scale(1)" },
            ]
          : [
              { opacity: 0, transform: "translateY(14px)" },
              { opacity: 1, transform: "translateY(0)" },
            ];
    const animation = featureRef.current.animate(frames, {
      duration: 400,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
    return () => animation.cancel();
  }, [advanceCount]);
  const showNextFeatured = () => {
    if (featuredTracks.length < 2) return;
    setFeaturedIndex(
      (index) =>
        (index + 1 + Math.floor(Math.random() * (featuredTracks.length - 1))) %
        featuredTracks.length,
    );
    setAdvanceCount((count) => count + 1);
  };
  const playable = catalogue.items.filter((item) => item.media && item.id !== featured?.id);
  const distinctReleases = playable.filter(
    (item, index) =>
      playable.findIndex((candidate) => candidate.release.id === item.release.id) === index,
  );
  const moreTracks = [
    ...distinctReleases,
    ...playable.filter((item) => !distinctReleases.some((release) => release.id === item.id)),
  ].slice(0, 3);
  return (
    <div className="radio-home">
      {featured ? (
        <section
          ref={featureRef}
          className="label-feature"
          aria-labelledby="feature-title"
          data-identity
          data-treatment="palette"
          style={identityStyle(featured.release.slug)}
        >
          <Link
            className="label-feature__art"
            to={featured.release.href}
            aria-label={`View ${featured.release.title}`}
          >
            <Artwork artwork={featured.artwork} size={620} />
          </Link>
          <div className="label-feature__copy">
            <span className="label-feature__eyebrow">SUNSYN / Featured listening</span>
            <h1
              id="feature-title"
              data-title-size={
                featured.release.title.length > 34
                  ? "compact"
                  : featured.release.title.length > 22
                    ? "medium"
                    : "regular"
              }
            >
              {featured.release.title}
            </h1>
            <Link className="label-feature__artist" to={featured.creator.href}>
              {featured.creator.name}
            </Link>
            <div className="label-feature__actions">
              <button
                type="button"
                disabled={!featured.media}
                onClick={() => player.playItem(featured, collection?.id)}
              >
                <ListenerIcon name="play" /> Play
              </button>
              <Link to={featured.release.href}>
                Explore release <ListenerIcon name="arrow" size={16} />
              </Link>
              {featuredTracks.length > 1 ? (
                <button
                  className="label-feature__another"
                  type="button"
                  onClick={showNextFeatured}
                  aria-label="Next featured song"
                >
                  Next <ListenerIcon name="arrow" size={16} />
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <CatalogueState state={catalogue} />
      )}
      <div className="content-layout">
        <section id="catalogue" className="track-section" aria-labelledby="radio-tracks-title">
          <div className="section-heading">
            <div>
              <span className="section-label">From the catalogue</span>
              <h2 id="radio-tracks-title" className="brand-display">
                Find your next listen
              </h2>
            </div>
            <Link className="text-action" to="/search">
              Explore all <ListenerIcon name="arrow" size={16} />
            </Link>
          </div>
          {catalogue.status === "ready" && moreTracks.length ? (
            <div className="label-discovery">
              {moreTracks.map((track) => (
                <article className="label-discovery__card" key={track.id}>
                  <Link
                    className="label-discovery__art"
                    to={`${track.release.href}#track-${track.slug}`}
                    aria-label={`View ${track.description.title} on ${track.release.title}`}
                  >
                    <Artwork artwork={track.artwork} size={360} />
                  </Link>
                  <div className="label-discovery__details">
                    <span className="label-discovery__kind">
                      {track.release.title} / {track.mediaKind}
                    </span>
                    <h3>
                      <Link to={`${track.release.href}#track-${track.slug}`}>
                        {trackLabel(track.description.title).title}
                      </Link>
                    </h3>
                    <Link className="label-discovery__artist" to={track.creator.href}>
                      {track.creator.name}
                    </Link>
                    <button
                      type="button"
                      aria-label={`Play ${track.description.title}`}
                      onClick={() => player.playItem(track, collection?.id)}
                    >
                      <ListenerIcon name="play" size={16} /> Play
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : catalogue.status !== "ready" ? (
            <CatalogueState state={catalogue} />
          ) : null}
          {!collection && catalogue.collections.length ? (
            <div className="radio-collections">
              {catalogue.collections.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/collections/${entry.slug}`}
                  aria-label={`View ${entry.name} collection`}
                >
                  {entry.name}
                  <span>{entry.items.length} tracks</span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
        <aside className="curator-note brand-panel-soft" aria-labelledby="radio-idea-title">
          <span className="section-label">The SUNSYN idea</span>
          <h2 id="radio-idea-title">Made with new tools. Chosen by human ears.</h2>
          <p>We find and share AI-created music worth spending time with.</p>
          <Link to="/about" className="note-signature">
            About the label <ListenerIcon name="arrow" size={15} />
          </Link>
        </aside>
      </div>
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
