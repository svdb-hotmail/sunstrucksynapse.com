import { forwardRef, useEffect, useRef, useState } from "react";

import { Link } from "react-router";
import { QueuePanel } from "~/components/QueuePanel";
import { ListenerSheet } from "~/components/ListenerSheet";
import { ShareButton } from "~/components/ShareButton";
import { Queue } from "~/components/Queue";
import { StationMark } from "~/design-system/StationMark";
import { ListenerIcon } from "~/design-system/ListenerIcon";
import { MediaButton } from "~/design-system/MediaButton";
import { Button } from "~/design-system/Button";
import { SITE_URL } from "~/config/brand";
import { PlaybackCoordinator } from "~/services/playback-coordinator";
import { recordPlaybackEvent } from "~/services/analytics.client";
import type { CatalogueItem, QueueEntry } from "~/types/catalogue";

export interface PlayerPanelProps {
  item: CatalogueItem | null;
  queue: QueueEntry[];
  history?: QueueEntry[];
  playbackRequest: {
    itemId: string;
    sequence: number;
    collectionId?: string;
    intent?: "resume";
  } | null;
  view?: "player" | "queue" | null;
  onViewChange?: (view: "player" | "queue" | null) => void;
  onPlaybackStateChange?: (itemId: string | null) => void;
  onMoveQueueEntry?: (itemId: string, direction: -1 | 1) => void;
  onReorderQueueEntry?: (itemId: string, targetItemId: string) => void;
  onClearQueue: () => void;
  onClearHistory?: () => void;
  onRemoveQueueEntry: (itemId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  onMediaEnded: () => void;
  onStartListening?: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function shouldClearLoadingOnPause(
  coordinator: Pick<PlaybackCoordinator, "isLoading">,
): boolean {
  return !coordinator.isLoading();
}

export const PlayerPanel = forwardRef<HTMLElement, PlayerPanelProps>(function PlayerPanel(
  {
    item,
    queue,
    history,
    playbackRequest,
    onClearQueue,
    onClearHistory,
    onRemoveQueueEntry,
    onPrevious,
    onNext,
    canPrevious,
    canNext,
    onMediaEnded,
    onStartListening,
    view,
    onViewChange,
    onPlaybackStateChange,
    onMoveQueueEntry,
    onReorderQueueEntry,
  },
  ref,
) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [localView, setLocalView] = useState<"player" | "queue" | null>(null);
  const panel = onViewChange ? (view ?? null) : localView;
  const changeView = onViewChange ?? setLocalView;
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const consumedPlaybackRequest = useRef<{ itemId: string; sequence: number } | null>(null);
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
      onErrorChange: (error) => {
        setPlaybackError(error);
        if (error) {
          setIsPlaying(false);
        }
      },
      onLoadingChange: setIsLoading,
    });
  }
  const coordinator = coordinatorRef.current;

  useEffect(() => {
    coordinator.attachMedia(mediaRef.current);
  });

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVolume(1);
    setIsMuted(false);
  }, [item?.id]);

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
    if (
      !item ||
      !item.media ||
      !playbackRequest ||
      playbackRequest.itemId !== item.id ||
      (consumedPlaybackRequest.current?.itemId === playbackRequest.itemId &&
        consumedPlaybackRequest.current.sequence === playbackRequest.sequence)
    ) {
      return;
    }
    consumedPlaybackRequest.current = {
      itemId: playbackRequest.itemId,
      sequence: playbackRequest.sequence,
    };
    if (playbackRequest.intent === "resume") {
      void coordinator.handleNativePlay();
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
    setIsPlaying(true);
    onPlaybackStateChange?.(item?.id ?? null);
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
    setCurrentTime(currentTime);
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
    setIsPlaying(false);
    onPlaybackStateChange?.(null);
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

  const togglePlayback = () => {
    const media = mediaRef.current;
    if (!media || !item?.media) {
      return;
    }
    if (media.paused) {
      void coordinator.handleNativePlay();
    } else {
      media.pause();
    }
  };

  const toggleMute = () => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }
    media.muted = !media.muted;
    setIsMuted(media.muted);
  };

  const changeVolume = (nextVolume: number) => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }
    media.volume = nextVolume;
    media.muted = nextVolume === 0;
    setVolume(nextVolume);
    setIsMuted(media.muted);
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
    preload: "none" as const,
    onContextMenu: preventMediaAction,
    onDragStart: preventMediaAction,
    onEnded: handleEnded,
    onPlay: handlePlay,
    onPause: () => {
      setIsPlaying(false);
      onPlaybackStateChange?.(null);
      if (shouldClearLoadingOnPause(coordinator)) {
        setIsLoading(false);
      }
    },
    onEmptied: () => {
      setIsPlaying(false);
      onPlaybackStateChange?.(null);
      setIsLoading(false);
      setCurrentTime(0);
      setDuration(0);
    },
    onTimeUpdate: handleTimeUpdate,
    onVolumeChange: () => {
      const media = mediaRef.current;
      if (media) {
        setVolume(media.volume);
        setIsMuted(media.muted);
      }
    },
    onLoadStart: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      // Restoring a paused source fires loadstart even with preload="none".
      // Show progress only for an explicit playback request or native playback.
      setIsLoading(coordinator.isLoading() || !event.currentTarget.paused);
    },
    onLoadedMetadata: () => {
      setIsLoading(false);
      setDuration(mediaRef.current?.duration ?? 0);
    },
    onCanPlay: () => setIsLoading(false),
    onError: () => {
      setIsPlaying(false);
      onPlaybackStateChange?.(null);
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

  const playbackStatus = (
    <>
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
    </>
  );
  const transport = (
    <div className="player-transport" aria-label="Playback navigation">
      <button type="button" onClick={onPrevious} disabled={!canPrevious} aria-label="Previous">
        <span aria-hidden="true">|◂</span>
      </button>
      <button
        type="button"
        className="dock-play"
        onClick={togglePlayback}
        disabled={!item?.media}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▸"}</span>
      </button>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label="Next">
        <span aria-hidden="true">▸|</span>
      </button>
    </div>
  );
  return (
    <aside
      ref={ref}
      className="player-panel"
      aria-label="Listening player"
      data-active={Boolean(item)}
      data-dock-visible={Boolean(item || queue.length)}
    >
      <div className="player-dock transport brand-topbar" aria-label="Playback controls">
        <div className="transport-track">
          {item ? (
            <button
              type="button"
              className="dock-track"
              onClick={() => changeView("player")}
              aria-label={`Open player: ${item.description.title}`}
            >
              <img
                className="artwork"
                src={playerArtwork}
                alt=""
                width="52"
                height="52"
                decoding="async"
              />
              <span>
                <strong>{item.description.title}</strong>
                <small>
                  {isPlaying ? "Playing" : "Paused"} · {item.creator.name}
                </small>
              </span>
            </button>
          ) : (
            <>
              <span className="idle-art">
                <StationMark />
              </span>
              <div>
                <strong>Find your next frequency</strong>
                <span>Select a track to start listening</span>
              </div>
            </>
          )}
        </div>
        <div className="transport-center">
          <div className="transport-controls">
            <MediaButton
              media="audio"
              emphasis="quiet"
              iconOnly
              onClick={onPrevious}
              disabled={!canPrevious}
              aria-label="Previous in dock"
            >
              <ListenerIcon name="back" size={17} />
            </MediaButton>
            <MediaButton
              media="audio"
              emphasis="primary"
              iconOnly
              className="dock-play"
              onClick={item ? togglePlayback : onStartListening}
              disabled={item ? !item.media : !onStartListening}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <ListenerIcon name={isPlaying ? "pause" : "play"} />
            </MediaButton>
            <MediaButton
              media="audio"
              emphasis="quiet"
              iconOnly
              onClick={onNext}
              disabled={!canNext}
              aria-label="Next"
            >
              <ListenerIcon name="next" size={17} />
            </MediaButton>
          </div>
          <div className="timeline">
            <span>{formatTime(currentTime).replace(/^0(?=\d:)/, "")}</span>
            <input
              type="range"
              min="0"
              max={duration || 1}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              disabled={!duration}
              aria-label="Playback position in dock"
              onChange={(event) => {
                if (mediaRef.current) mediaRef.current.currentTime = Number(event.target.value);
              }}
            />
            <span>{formatTime(duration).replace(/^0(?=\d:)/, "")}</span>
          </div>
        </div>
        <div className="transport-tools">
          <label className="volume-control">
            <ListenerIcon name="volume" size={18} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              aria-label="Volume in dock"
              disabled={!item?.media}
              onChange={(event) => changeVolume(Number(event.target.value))}
            />
          </label>
          <Button
            className="dock-desktop-queue"
            onClick={() => changeView(panel === "queue" ? null : "queue")}
            aria-label={`Open queue in dock, ${queue.length} tracks`}
            aria-expanded={panel === "queue"}
          >
            <ListenerIcon name="queue" />
            <span>{queue.length}</span>
          </Button>
        </div>
      </div>
      {panel === null ? (
        <div className="listener-feedback">
          {playbackStatus}
        </div>
      ) : null}
      <ListenerSheet
        open={panel === "player"}
        title={panel === "queue" ? "Your queue" : "Now playing"}
        onClose={() => changeView(null)}
      >
        {playbackStatus}
        <div className="listener-full-player" hidden={panel !== "player"}>
          {item ? (
            <>
              {item.mediaKind === "audio" ? (
                <img
                  className="listener-player-art"
                  src={playerArtwork}
                  alt={item.artwork.alt}
                  width="180"
                  height="180"
                  decoding="async"
                />
              ) : null}
              <div className="now-playing">
                <h3>{item.description.title}</h3>
                <p className="subtitle">{item.creator.name}</p>
              </div>
            </>
          ) : (
            <p>Choose a track to start listening.</p>
          )}
          <div className="protected-player" aria-busy={isLoading}>
            {!item?.media ? (
              <p className="player-placeholder">Media unavailable.</p>
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
                poster={item.media.poster}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                {...mediaProps}
              >
                <source src={activeMediaSrc ?? item.media.src} type={item.media.mimeType} />
              </video>
            )}
          </div>
          <div className="dock-progress">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              disabled={!duration}
              aria-label="Playback position"
              onChange={(event) => {
                if (mediaRef.current)
                  mediaRef.current.currentTime = Number(event.currentTarget.value);
              }}
            />
            <span>{formatTime(duration)}</span>
          </div>
          {transport}
          <div className="dock-volume">
            <button
              type="button"
              onClick={toggleMute}
              disabled={!item?.media}
              aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              disabled={!item?.media}
              aria-label="Volume"
              onChange={(event) => changeVolume(Number(event.currentTarget.value))}
            />
          </div>
          {item ? (
            <div className="listener-player-actions">
              <button type="button" onClick={() => changeView("queue")}>
                Up next · {queue.length}
              </button>
              <ShareButton
                title={item.description.title}
                url={new URL(item.href, SITE_URL).href}
                trackId={item.id}
              />
              <Link to={item.href} onClick={() => changeView(null)}>
                Track details & credits
              </Link>
            </div>
          ) : null}
        </div>
      </ListenerSheet>
      <QueuePanel
        open={panel === "queue"}
        onClose={() => changeView(null)}
        queue={queue}
        history={history ?? []}
        onClearHistory={onClearHistory ?? (() => undefined)}
        feedback={
          <>
            {playbackStatus}
          </>
        }
      >
        <div>
          <Queue
            entries={queue}
            onClear={onClearQueue}
            onRemove={onRemoveQueueEntry}
            onMove={onMoveQueueEntry}
            onReorder={onReorderQueueEntry}
            currentEntry={
              item
                ? {
                    itemId: item.id,
                    title: item.description.title,
                    subtitle: item.description.subtitle,
                  }
                : null
            }
            isPlaying={isPlaying}
          />
        </div>
      </QueuePanel>
    </aside>
  );
});
