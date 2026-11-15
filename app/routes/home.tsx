import { data, Link, useOutletContext } from "react-router";
import { useEffect, useRef, useState } from "react";

import { ListenerIcon } from "~/design-system/ListenerIcon";
import { trackLabel } from "~/design-system/track-label";
import { Artwork } from "~/design-system/Artwork";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/brand";
import { catalogueStateCopy } from "~/services/catalogue";
import { listeningSelection } from "~/services/listening";
import { identityStyle } from "~/design-system/visual-identity";
import { featuredSession } from "~/services/featured-session.server";
import { selectFeaturedTracks } from "~/services/featured-selection";
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

export function loader({ request }: Route.LoaderArgs) {
  const session = featuredSession(request);
  return data({ featuredSeed: session.seed }, { headers: session.headers });
}

export default function Home({ loaderData }: Partial<Route.ComponentProps>) {
  const player = useOutletContext<PlayerOutletContext>();
  const { catalogue } = player;
  const { collection } = listeningSelection(catalogue.items, catalogue.collections);
  const featuredTracks = selectFeaturedTracks(
    catalogue.items,
    loaderData?.featuredSeed ?? "preview",
  );
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [advanceCount, setAdvanceCount] = useState(0);
  const featureRef = useRef<HTMLElement>(null);
  const featureTitleRef = useRef<HTMLHeadingElement>(null);
  const featured = featuredTracks.length
    ? featuredTracks[featuredIndex % featuredTracks.length]
    : undefined;
  const featuredPalette = featured?.artwork.palette;
  useEffect(() => {
    const title = featureTitleRef.current;
    if (!title) return;
    const fitTitle = () => {
      title.style.removeProperty("font-size");
      const computed = getComputedStyle(title);
      const baseSize = Number.parseFloat(computed.fontSize);
      const available = title.clientWidth;
      if (!available || !baseSize) return;
      const longestWord = Math.max(
        ...(title.textContent ?? "").split(/\s+/).map((word) => word.length),
      );
      let fits = false;
      for (let size = baseSize; size >= 16; size -= 1) {
        title.style.setProperty("font-size", `${size}px`, "important");
        const style = getComputedStyle(title);
        const lineHeight = Number.parseFloat(style.lineHeight) || size;
        const lineCount = Math.round(title.scrollHeight / lineHeight);
        if (lineCount <= 2 && title.scrollWidth <= available + 1) {
          fits = true;
          break;
        }
      }
      if (!fits) {
        title.style.removeProperty("font-size");
        title.style.setProperty(
          "font-size",
          `${Math.max(16, Math.min(baseSize, available / Math.max(longestWord, 1)))}px`,
          "important",
        );
      }
      title.dataset.fit = fits ? "two-lines" : "natural-wrap";
    };
    const observer = new ResizeObserver(fitTitle);
    observer.observe(title);
    document.fonts?.ready.then(fitTitle);
    fitTitle();
    return () => observer.disconnect();
  }, [featured?.release.title]);
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
          style={identityStyle(featured.release.slug, featuredPalette)}
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
            <h1 id="feature-title" ref={featureTitleRef}>
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
