import { forwardRef } from "react";

import { MediaModeTabs } from "~/components/MediaModeTabs";
import { NowPlaying } from "~/components/NowPlaying";
import { Queue } from "~/components/Queue";
import type {
  CatalogueItem,
  MediaKind,
  QueueEntry,
} from "~/types/catalogue";

interface PlayerPanelProps {
  item: CatalogueItem;
  mode: MediaKind;
  queue: QueueEntry[];
  onModeChange: (mode: MediaKind) => void;
  onClearQueue: () => void;
}

export const PlayerPanel = forwardRef<HTMLElement, PlayerPanelProps>(
  function PlayerPanel(
    { item, mode, queue, onModeChange, onClearQueue },
    ref,
  ) {
    const preventMediaAction = (event: React.SyntheticEvent) => event.preventDefault();
    const playerArtwork = item.artwork.playerSrc ?? item.artwork.src;

    return (
      <aside
        ref={ref}
        className="player-panel"
        aria-label="Featured media player"
        tabIndex={-1}
      >
        <div className="brand-orb" aria-hidden="true">
          <span>SS</span>
        </div>

        <div className="hero-art">
          <img
            src={playerArtwork}
            alt={item.artwork.alt}
            draggable={false}
            onContextMenu={preventMediaAction}
            onDragStart={preventMediaAction}
          />
        </div>

        <div className="now-playing">
          <NowPlaying item={item} />
          <MediaModeTabs mode={mode} onModeChange={onModeChange} />

          <div className="protected-player">
            {mode === "audio" ? (
              <audio
                className="protected-media"
                aria-label={`${item.description.title} audio player`}
                controls
                controlsList="nodownload noplaybackrate"
                preload="none"
                onContextMenu={preventMediaAction}
                onDragStart={preventMediaAction}
              />
            ) : (
              <video
                className="protected-media"
                aria-label={`${item.description.title} video player`}
                controls
                controlsList="nodownload noplaybackrate"
                preload="none"
                poster="/assets/posters/video-poster.svg"
                disablePictureInPicture
                onContextMenu={preventMediaAction}
                onDragStart={preventMediaAction}
              />
            )}
            <p className="player-placeholder">Media preview source pending catalogue integration.</p>
          </div>

          <div className="transport-fake" aria-hidden="true">
            <span>&#8634;</span>
            <span>&#9665;</span>
            <span className="play-dot">&#9654;</span>
            <span>&#9655;</span>
            <span>&#8734;</span>
          </div>
        </div>

        <Queue entries={queue} onClear={onClearQueue} />

        <footer className="panel-footer">
          <a href="#offerings">Offerings</a>
          <a href="#contact">Contact</a>
        </footer>
      </aside>
    );
  },
);
