import { forwardRef, useEffect, useRef, useState } from "react";

import { NowPlaying } from "~/components/NowPlaying";
import { Queue } from "~/components/Queue";
import type { CatalogueItem, QueueEntry } from "~/types/catalogue";

interface PlayerPanelProps {
  item: CatalogueItem;
  queue: QueueEntry[];
  playbackRequest: { itemId: string; sequence: number } | null;
  onClearQueue: () => void;
  onSelectQueueEntry: (entry: QueueEntry) => void;
  onMediaEnded: () => void;
}

export const PlayerPanel = forwardRef<HTMLElement, PlayerPanelProps>(function PlayerPanel(
  { item, queue, playbackRequest, onClearQueue, onSelectQueueEntry, onMediaEnded },
  ref,
) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const preventMediaAction = (event: React.SyntheticEvent) => event.preventDefault();
  const playerArtwork = item.artwork.playerSrc ?? item.artwork.src;

  useEffect(() => {
    setPlaybackError(null);
    const mediaElement = mediaRef.current;
    if (!mediaElement || !item.media) {
      return;
    }

    let isCurrentRequest = true;
    mediaElement.load();
    if (playbackRequest?.itemId === item.id) {
      void mediaElement.play().catch(() => {
        if (isCurrentRequest && mediaRef.current === mediaElement) {
          setPlaybackError(
            "Playback could not start automatically. Use the player controls to begin.",
          );
        }
      });
    }

    return () => {
      isCurrentRequest = false;
    };
  }, [item.id, item.media, playbackRequest]);

  const mediaProps = {
    className: "protected-media",
    controls: true,
    controlsList: "nodownload noplaybackrate",
    preload: "metadata" as const,
    onContextMenu: preventMediaAction,
    onDragStart: preventMediaAction,
    onEnded: onMediaEnded,
    onError: () => setPlaybackError("This preview could not be loaded."),
  };

  return (
    <aside ref={ref} className="player-panel" aria-label="Featured media player" tabIndex={-1}>
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

        <div className="protected-player">
          {!item.media ? (
            <p className="player-placeholder">Preview coming soon.</p>
          ) : item.mediaKind === "audio" ? (
            <audio
              key={item.id}
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              aria-label={`${item.description.title} audio player`}
              {...mediaProps}
            >
              <source src={item.media.src} type={item.media.mimeType} />
            </audio>
          ) : (
            <video
              key={item.id}
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              aria-label={`${item.description.title} video player`}
              poster={item.media.poster ?? "/assets/posters/video-poster.svg"}
              disablePictureInPicture
              {...mediaProps}
            >
              <source src={item.media.src} type={item.media.mimeType} />
            </video>
          )}
          {playbackError ? (
            <p className="player-error" role="alert">
              {playbackError}
            </p>
          ) : null}
        </div>
      </div>

      <Queue entries={queue} onClear={onClearQueue} onSelect={onSelectQueueEntry} />

      <footer className="panel-footer">
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </footer>
    </aside>
  );
});
