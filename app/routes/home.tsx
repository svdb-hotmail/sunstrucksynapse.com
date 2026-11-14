import { Link, useOutletContext } from "react-router";

import { EntityTrackList } from "~/components/EntityTrackList";
import { ListenerIcon } from "~/design-system/ListenerIcon";
import { trackLabel } from "~/design-system/track-label";
import { Artwork } from "~/design-system/Artwork";
import { RadioStart } from "~/components/RadioStart";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/brand";
import { catalogueStateCopy } from "~/services/catalogue";
import { listeningSelection } from "~/services/listening";
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
  const { collection, tracks } = listeningSelection(catalogue.items, catalogue.collections);
  const previewTracks = tracks.slice(0, 6);
  return (
    <div className="radio-home">
      <RadioStart
        tracks={tracks}
        collection={collection}
        onPlay={
          player.playSelection ? () => player.playSelection?.(tracks, collection?.id) : undefined
        }
      />
      <div className="content-layout">
        <section id="catalogue" className="track-section" aria-labelledby="radio-tracks-title">
          <div className="section-heading">
            <div>
              <h2 id="radio-tracks-title" className="brand-display">
                Featured
              </h2>
            </div>
            <Link className="text-action" to="/search">
              Explore all <ListenerIcon name="arrow" size={16} />
            </Link>
          </div>
          {catalogue.status === "ready" ? (
            <div className="track-list">
              <EntityTrackList
                tracks={previewTracks}
                player={player}
                collectionId={collection?.id}
                simpleActions
              />
            </div>
          ) : (
            <CatalogueState state={catalogue} />
          )}
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
          <span className="note-symbol" aria-hidden="true">
            ✦
          </span>
          <span className="section-label">The SunSyn idea</span>
          <h2 id="radio-idea-title">
            Tools make possibilities.
            <br />
            People make choices.
          </h2>
          <p>
            AI is part of the process. Human intention is the point. Every selection starts with
            listening.
          </p>
          <Link to="/about" className="note-signature">
            Curated with care <ListenerIcon name="check" size={15} />
          </Link>
        </aside>
      </div>
      {previewTracks.length ? (
        <section className="release-section">
          <div className="section-heading">
            <div>
              <span className="section-label">Go a little deeper</span>
              <h2 className="brand-display">Discover the sound</h2>
            </div>
            <span className="muted">
              {[...new Set(previewTracks.map((track) => track.creator.name))].join(", ")}
            </span>
          </div>
          <div className="release-grid">
            {previewTracks.slice(0, 4).map((track) => (
              <Link to={track.href} className="release-card brand-card" key={track.id}>
                <Artwork artwork={track.artwork} size={130} />
                <div>
                  <span className="section-label">Featured track</span>
                  <h3>{trackLabel(track.description.title).title}</h3>
                  <p>{trackLabel(track.description.title).subtitle ?? track.creator.name}</p>
                  <span className="release-link">
                    Listen & discover <ListenerIcon name="arrow" size={17} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
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
