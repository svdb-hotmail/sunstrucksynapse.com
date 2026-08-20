import { forwardRef, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { NowPlaying } from "~/components/NowPlaying";
import { Queue } from "~/components/Queue";
import { PlaybackCoordinator } from "~/services/playback-coordinator";
import { recordPlaybackEvent } from "~/services/analytics.client";
import type { CatalogueItem, QueueEntry } from "~/types/catalogue";

interface PlayerPanelProps {
  item: CatalogueItem | null;
  queue: QueueEntry[];
  playbackRequest: { itemId: string; sequence: number; collectionId?: string } | null;
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
  const trackedPlayback = useRef<{
    itemId: string | null;
    collectionId?: string;
    started: boolean;
    thirtySeconds: boolean;
    completed: boolean;
  }>({
    itemId: item?.id ?? null,
    started: false,
    thirtySeconds: false,
    completed: false,
  });
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMedia, setActiveMedia] = useState<{
    itemId: string;
    src: string;
  } | null>(item?.media ? { itemId: item.id, src: item.media.src } : null);
  const preventMediaAction = (event: React.SyntheticEvent) => event.preventDefault();
  const playerArtwork = item
    ? (item.artwork.playerSrc ?? item.artwork.src)
    : "/assets/hero-art.svg";

  const coordinatorRef = useRef<PlaybackCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new PlaybackCoordinator({
      onActiveSrcChange: (src, itemId) => {
        setActiveMedia(src && itemId ? { itemId, src } : null);
      },
      onErrorChange: setPlaybackError,
      onLoadingChange: setIsLoading,
    });
  }
  const coordinator = coordinatorRef.current;

  useEffect(() => {
    coordinator.attachMedia(mediaRef.current);
  });

  useEffect(() => {
    const tracked = trackedPlayback.current;
    if (tracked.itemId && tracked.itemId !== item?.id && tracked.started && !tracked.completed) {
      recordPlaybackEvent("skip", {
        trackId: tracked.itemId,
        ...(tracked.collectionId !== undefined ? { collectionId: tracked.collectionId } : {}),
        progressSeconds: Math.floor(mediaRef.current?.currentTime ?? 0),
      });
    }
    if (tracked.itemId !== item?.id) {
      trackedPlayback.current = {
        itemId: item?.id ?? null,
        started: false,
        thirtySeconds: false,
        completed: false,
      };
    }
    coordinator.selectItem(item);
    if (!item || !playbackRequest || playbackRequest.itemId !== item.id) {
      return;
    }
    trackedPlayback.current.collectionId = playbackRequest.collectionId;
    recordPlaybackEvent("play_requested", {
      trackId: item.id,
      ...(playbackRequest.collectionId !== undefined
        ? { collectionId: playbackRequest.collectionId }
        : {}),
    });
    void coordinator.playRequested(item);
  }, [coordinator, item, playbackRequest]);

  const handlePlay = () => {
    const tracked = trackedPlayback.current;
    if (item) {
      if (tracked.completed) {
        recordPlaybackEvent("replay", {
          trackId: item.id,
          ...(tracked.collectionId !== undefined ? { collectionId: tracked.collectionId } : {}),
        });
        tracked.completed = false;
        tracked.thirtySeconds = false;
      } else if (!tracked.started) {
        recordPlaybackEvent("playback_started", {
          trackId: item.id,
          ...(tracked.collectionId !== undefined ? { collectionId: tracked.collectionId } : {}),
        });
      }
      tracked.started = true;
    }
    void coordinator.handleNativePlay();
  };

  const handleTimeUpdate = () => {
    const tracked = trackedPlayback.current;
    const currentTime = mediaRef.current?.currentTime ?? 0;
    if (item && tracked.started && !tracked.thirtySeconds && currentTime >= 30) {
      tracked.thirtySeconds = true;
      recordPlaybackEvent("listen_30_seconds", {
        trackId: item.id,
        ...(tracked.collectionId !== undefined ? { collectionId: tracked.collectionId } : {}),
        progressSeconds: 30,
      });
    }
  };

  const handleEnded = () => {
    if (item) {
      trackedPlayback.current.completed = true;
      recordPlaybackEvent("completion", {
        trackId: item.id,
        ...(trackedPlayback.current.collectionId !== undefined
          ? { collectionId: trackedPlayback.current.collectionId }
          : {}),
        progressSeconds: Math.floor(mediaRef.current?.duration ?? 0),
      });
    }
    onMediaEnded();
  };

  const retryPlayback = () => {
    void coordinator.retry();
  };

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
    setHandler("play", () => {
      void coordinator.handleNativePlay();
    });
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
  }, [coordinator, item, onNext, onPrevious]);

  const mediaProps = {
    className: "protected-media",
    controls: true,
    controlsList: "nodownload noplaybackrate",
    preload: "none" as const,
    onContextMenu: preventMediaAction,
    onDragStart: preventMediaAction,
    onEnded: handleEnded,
    onPlay: handlePlay,
    onTimeUpdate: handleTimeUpdate,
    onLoadStart: () => setIsLoading(true),
    onLoadedMetadata: () => setIsLoading(false),
    onCanPlay: () => setIsLoading(false),
    onError: () => {
      setIsLoading(false);
      setPlaybackError("This preview could not be loaded. Check your connection and retry.");
      if (item) {
        const tracked = trackedPlayback.current;
        recordPlaybackEvent("playback_error", {
          trackId: item.id,
          ...(tracked.collectionId !== undefined ? { collectionId: tracked.collectionId } : {}),
        });
      }
    },
  };
  const activeMediaSrc =
    activeMedia && activeMedia.itemId === item?.id ? activeMedia.src : (item?.media?.src ?? null);

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
              <source src={activeMediaSrc ?? item.media.src} type={item.media.mimeType} />
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
              <source src={activeMediaSrc ?? item.media.src} type={item.media.mimeType} />
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
        <Link to="/privacy">Privacy</Link>
        <Link to="/submission-terms">Terms</Link>
        <Link to="/takedown">Takedown</Link>
      </footer>
    </aside>
  );
});
