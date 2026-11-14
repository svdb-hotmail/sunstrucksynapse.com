import { Link, useOutletContext } from "react-router";
import { useEffect, useState } from "react";

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
  const showSkinSelector =
    import.meta.env.DEV || ["site-preview", "test"].includes(import.meta.env.MODE);
  const player = useOutletContext<PlayerOutletContext>();
  const { catalogue } = player;
  const { collection } = listeningSelection(catalogue.items, catalogue.collections);
  const playableReleases = catalogue.items.filter(
    (item) => item.mediaKind === "audio" && item.media,
  );
  const featuredReleases = [
    ...new Map(playableReleases.map((item) => [item.release.id, item])).values(),
  ].sort((a, b) =>
    a.release.slug === "phase-zero-transmissions"
      ? -1
      : b.release.slug === "phase-zero-transmissions"
        ? 1
        : a.release.title.localeCompare(b.release.title),
  );
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featured = featuredReleases[featuredIndex % featuredReleases.length];
  const playable = catalogue.items.filter((item) => item.media && item.id !== featured?.id);
  const distinctReleases = playable.filter(
    (item, index) =>
      playable.findIndex((candidate) => candidate.release.id === item.release.id) === index,
  );
  const moreTracks = [
    ...distinctReleases,
    ...playable.filter((item) => !distinctReleases.some((release) => release.id === item.id)),
  ].slice(0, 3);
  const [skin, setSkin] = useState<"editorial" | "underground" | "synth">("editorial");
  const identityPreviewActive = catalogue.items.some((item) =>
    item.creator.slug.startsWith("preview-"),
  );
  useEffect(() => {
    if (showSkinSelector) {
      document.documentElement.dataset.skin = skin;
      return () => {
        delete document.documentElement.dataset.skin;
      };
    }
  }, [showSkinSelector, skin]);
  return (
    <div className="radio-home">
      {showSkinSelector && (
        <div className="skin-selector" role="group" aria-label="Design direction">
          <span>Design direction</span>
          {(["editorial", "underground", "synth"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={skin === option}
              onClick={() => setSkin(option)}
            >
              {option}
            </button>
          ))}
          {import.meta.env.MODE === "test" ? (
            <a href={identityPreviewActive ? "/?identity-preview=0" : "/?identity-preview=1"}>
              {identityPreviewActive ? "Standard catalogue" : "Three-artist study"}
            </a>
          ) : null}
        </div>
      )}
      {featured ? (
        <section
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
            <h1 id="feature-title">{featured.release.title}</h1>
            <Link className="label-feature__artist" to={featured.creator.href}>
              {featured.creator.name}
            </Link>
            <p className="label-feature__track">
              Start with “{trackLabel(featured.description.title).title}”
            </p>
            <div className="label-feature__actions">
              <button
                type="button"
                disabled={!featured.media}
                onClick={() => player.playItem(featured, collection?.id)}
              >
                <ListenerIcon name="play" /> Play the music
              </button>
              <Link to={featured.release.href}>
                Explore release <ListenerIcon name="arrow" size={16} />
              </Link>
              {featuredReleases.length > 1 ? (
                <button
                  className="label-feature__another"
                  type="button"
                  onClick={() => setFeaturedIndex((index) => (index + 1) % featuredReleases.length)}
                >
                  Discover another
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
                    to={track.href}
                    aria-label={`View ${track.description.title}`}
                  >
                    <Artwork artwork={track.artwork} size={360} />
                  </Link>
                  <div className="label-discovery__details">
                    <span className="label-discovery__kind">
                      {track.release.title} / {track.mediaKind}
                    </span>
                    <h3>
                      <Link to={track.href}>{trackLabel(track.description.title).title}</Link>
                    </h3>
                    <Link className="label-discovery__artist" to={track.creator.href}>
                      {track.creator.name}
                    </Link>
                    <button type="button" onClick={() => player.playItem(track, collection?.id)}>
                      <ListenerIcon name="play" size={16} /> Play “
                      {trackLabel(track.description.title).title}”
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
