import { Link } from "react-router";
import { SignalIllustration } from "~/design-system/SignalIllustration";
import { MediaButton } from "~/design-system/MediaButton";
import { ListenerIcon } from "~/design-system/ListenerIcon";
import type { CatalogueItem, PublicEditorialCollection } from "~/types/catalogue";

export function RadioStart({
  tracks,
  collection,
  onPlay,
}: {
  tracks: CatalogueItem[];
  collection?: PublicEditorialCollection;
  onPlay?: () => void;
}) {
  return (
    <section className="radio-start listening-hero brand-panel" aria-labelledby="radio-start-title">
      <div className="hero-copy">
        <span className="section-label">A space for intentional sound</span>
        <h1 id="radio-start-title" className="brand-display">
          Human ears.
          <br />
          <span className="brand-gradient-text">New frequencies.</span>
        </h1>
        <p>
          Music made with imagination.
          <br />
          Selected by people. Here to be heard.
        </p>
        <div className="hero-actions">
          <MediaButton
            media="audio"
            emphasis="primary"
            className="listener-primary"
            disabled={!tracks.length || !onPlay}
            onClick={onPlay}
          >
            <ListenerIcon name="play" /> Start listening
          </MediaButton>
          <Link className="brand-button-secondary kb-system-button" to="/search">
            Explore the music <ListenerIcon name="arrow" size={17} />
          </Link>
        </div>
        {tracks.length ? (
          <small className="hero-footnote">
            {collection ? (
              <Link
                to={`/collections/${collection.slug}`}
                aria-label={`View ${collection.name} collection`}
              >
                Plays in selection order
              </Link>
            ) : (
              "Plays in selection order"
            )}{" "}
            · replaces your queue
          </small>
        ) : null}
      </div>
      <SignalIllustration />
    </section>
  );
}
