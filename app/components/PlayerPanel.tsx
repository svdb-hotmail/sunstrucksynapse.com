import { forwardRef, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { NowPlaying } from "~/components/NowPlaying";
import { Queue } from "~/components/Queue";
import type { CatalogueItem, QueueEntry } from "~/types/catalogue";

interface PlayerPanelProps {
  item: CatalogueItem | null;
  queue: QueueEntry[];
  playbackRequest: { itemId: string; sequence: number } | null;
  onClearQueue: () => void;
  onSelectQueueEntry: (entry: QueueEntry) => void;
  onRemoveQueueEntry: (itemId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  onMediaEnded: () => void;
}

export const PlayerPanel = forwardRef<HTMLElement, PlayerPanelProps>(function PlayerPanel(
  {
    item,
    queue,
    playbackRequest,
    onClearQueue,
    onSelectQueueEntry,
    onRemoveQueueEntry,
    onPrevious,
    onNext,
    canPrevious,
    canNext,
    onMediaEnded,
  },
  ref,
) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const preventMediaAction = (event: React.SyntheticEvent) => event.preventDefault();
  const playerArtwork = item
    ? (item.artwork.playerSrc ?? item.artwork.src)
    : "/assets/hero-art.svg";

  useEffect(() => {
    setPlaybackError(null);
    const mediaElement = mediaRef.current;
    if (!mediaElement || !item?.media) {
      setIsLoading(false);
      return;
    }

    let isCurrentRequest = true;
    setIsLoading(true);
    mediaElement.load();
    if (playbackRequest?.itemId === item.id) {
      void mediaElement.play().catch(() => {
        if (isCurrentRequest && mediaRef.current === mediaElement) {
          setPlaybackError(
            "Playback could not start automatically. Use the player controls to begin.",
          );
          setIsLoading(false);
        }
      });
    }

    return () => {
      isCurrentRequest = false;
    };
  }, [item?.id, playbackRequest]);

  useEffect(() => {
    if (!item?.media || !("mediaSession" in navigator)) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.description.title,
      artist: item.creator.name,
      album: item.release.title,
      artwork: [
        {
          src: new URL(item.artwork.src, window.location.href).href,
        },
      ],
    });

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "NotSupportedError")) {
          console.error(`Media Session action ${action} failed.`, error);
        }
      }
    };
    setHandler("play", () => void mediaRef.current?.play());
    setHandler("pause", () => mediaRef.current?.pause());
    setHandler("previoustrack", onPrevious);
    setHandler("nexttrack", onNext);
    setHandler("seekbackward", ({ seekOffset }) => {
      const media = mediaRef.current;
      if (media) {
        media.currentTime = Math.max(0, media.currentTime - (seekOffset ?? 10));
      }
    });
    setHandler("seekforward", ({ seekOffset }) => {
      const media = mediaRef.current;
      if (media) {
        media.currentTime = Math.min(
          media.duration || Infinity,
          media.currentTime + (seekOffset ?? 10),
        );
      }
    });
    setHandler("seekto", ({ seekTime }) => {
      const media = mediaRef.current;
      if (media && typeof seekTime === "number") {
        media.currentTime = seekTime;
      }
    });

    return () => {
      for (const action of [
        "play",
        "pause",
        "previoustrack",
        "nexttrack",
        "seekbackward",
        "seekforward",
        "seekto",
      ] as MediaSessionAction[]) {
        setHandler(action, null);
      }
    };
  }, [item, onNext, onPrevious]);

  const retryPlayback = () => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }
    setPlaybackError(null);
    setIsLoading(true);
    media.load();
    void media.play().catch(() => {
      setIsLoading(false);
      setPlaybackError("Playback is still unavailable. Check your connection and try again.");
    });
  };

  const mediaProps = {
    className: "protected-media",
    controls: true,
    controlsList: "nodownload noplaybackrate",
    preload: "metadata" as const,
    onContextMenu: preventMediaAction,
    onDragStart: preventMediaAction,
    onEnded: onMediaEnded,
    onLoadStart: () => setIsLoading(true),
    onLoadedMetadata: () => setIsLoading(false),
    onCanPlay: () => setIsLoading(false),
    onError: () => {
      setIsLoading(false);
      setPlaybackError("This preview could not be loaded. Check your connection and retry.");
    },
  };

  return (
    <aside ref={ref} className="player-panel" aria-label="Featured media player" tabIndex={-1}>
      <div className="brand-orb" aria-hidden="true">
        <span>SS</span>
      </div>

      <div className="hero-art">
        <img
          src={playerArtwork}
          alt={item?.artwork.alt ?? "Sunstruck Synapse Radio artwork"}
          draggable={false}
          onContextMenu={preventMediaAction}
          onDragStart={preventMediaAction}
        />
      </div>

      <div className="now-playing">
        {item ? (
          <NowPlaying item={item} />
        ) : (
          <>
            <p className="kicker">Now playing</p>
            <h1>Catalogue unavailable</h1>
            <p className="subtitle">Select a published track when the catalogue returns.</p>
          </>
        )}

        <div className="protected-player" aria-busy={isLoading}>
          {!item?.media ? (
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
          {isLoading ? (
            <p className="player-loading" role="status">
              Loading media…
            </p>
          ) : null}
          {playbackError ? (
            <div className="player-error" role="alert">
              <p>{playbackError}</p>
              <button type="button" onClick={retryPlayback}>
                Retry
              </button>
            </div>
          ) : null}
        </div>
        <div className="player-transport" aria-label="Playback navigation">
          <button type="button" onClick={onPrevious} disabled={!canPrevious}>
            Previous
          </button>
          <button type="button" onClick={onNext} disabled={!canNext}>
            Next
          </button>
        </div>
      </div>

      <Queue
        entries={queue}
        onClear={onClearQueue}
        onSelect={onSelectQueueEntry}
        onRemove={onRemoveQueueEntry}
      />

      <footer className="panel-footer">
        <Link to="/#about">About</Link>
        <Link to="/#contact">Contact</Link>
      </footer>
    </aside>
  );
});
