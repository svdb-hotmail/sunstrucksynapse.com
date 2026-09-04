import { forwardRef, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { NowPlaying } from "~/components/NowPlaying";
import { Queue } from "~/components/Queue";
import { SITE_NAME } from "~/config/brand";
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

const signalBars = [
  18, 32, 24, 48, 30, 62, 38, 72, 44, 28, 54, 36, 66, 42, 78, 50, 34, 64, 40, 58, 28, 46, 34, 70,
  44, 30, 60, 38, 74, 48, 32, 56, 42, 68, 36, 52, 26, 44, 30, 62,
];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
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
    setIsPlaying(true);
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
      void media.play();
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
    onPause: () => setIsPlaying(false),
    onTimeUpdate: handleTimeUpdate,
    onVolumeChange: () => {
      const media = mediaRef.current;
      if (media) {
        setVolume(media.volume);
        setIsMuted(media.muted);
      }
    },
    onLoadStart: () => setIsLoading(true),
    onLoadedMetadata: () => {
      setIsLoading(false);
      setDuration(mediaRef.current?.duration ?? 0);
    },
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
      <div className="radio-hero">
        <div className="now-playing">
          {item ? (
            <NowPlaying item={item} />
          ) : (
            <>
              <p className="kicker">Featured transmission</p>
              <h1>Signal unavailable</h1>
              <p className="subtitle">Select a published track when the catalogue returns.</p>
            </>
          )}
          <button
            type="button"
            className="hero-play"
            onClick={togglePlayback}
            disabled={!item?.media}
            aria-label={isPlaying ? "Pause featured transmission" : "Play featured transmission"}
          >
            <span className="hero-play-icon" aria-hidden="true">
              {isPlaying ? "Ⅱ" : "▶"}
            </span>
            <span>
              <strong>{isPlaying ? "Pause transmission" : "Play transmission"}</strong>
              <small>Curated for intentional listening.</small>
            </span>
          </button>
        </div>

        <div className="hero-art">
          <img
            src={playerArtwork}
            alt={item?.artwork.alt ?? `${SITE_NAME} artwork`}
            draggable={false}
            onContextMenu={preventMediaAction}
            onDragStart={preventMediaAction}
          />
        </div>

        <div className="signal-stack">
          <div className="signal-monitor">
            <div className="frequency-scale" aria-hidden="true">
              <span>88</span>
              <span>92</span>
              <span>96</span>
              <span>100</span>
              <span>104</span>
              <span>108</span>
            </div>
            <div className="signal-wave" aria-hidden="true">
              {signalBars.map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="signal-needle" aria-hidden="true" />
            <div className="protected-player" aria-busy={isLoading}>
              {!item?.media ? (
                <p className="player-placeholder">Preview coming soon.</p>
              ) : item.mediaKind === "audio" ? (
                <audio
                  key={item.id}
                  ref={mediaRef as React.RefObject<HTMLAudioElement>}
                  aria-label={`${item.description.title} audio player`}
                  controls
                  controlsList="nodownload noplaybackrate"
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
                  controls
                  controlsList="nodownload noplaybackrate"
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
          </div>
          <blockquote className="curator-note">
            <strong>Curator’s note</strong>
            <p>
              Selected for musical character, clear intent, and a human hand you can still hear.
            </p>
            <cite>— SunSyn</cite>
          </blockquote>
        </div>
      </div>

      <div className="player-dock" aria-label="Playback controls">
        <div className="dock-track">
          <img src={playerArtwork} alt="" aria-hidden="true" />
          <span>
            <strong>{item?.description.title ?? "No transmission selected"}</strong>
            <small>{item?.creator.name ?? SITE_NAME}</small>
          </span>
        </div>
        <div className="player-transport" aria-label="Playback navigation">
          <button type="button" onClick={onPrevious} disabled={!canPrevious}>
            <span aria-hidden="true">|◀</span>
            <span className="visually-hidden">Previous</span>
          </button>
          <button
            type="button"
            className="dock-play"
            onClick={togglePlayback}
            disabled={!item?.media}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
          </button>
          <button type="button" onClick={onNext} disabled={!canNext}>
            <span aria-hidden="true">▶|</span>
            <span className="visually-hidden">Next</span>
          </button>
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
              if (mediaRef.current) {
                mediaRef.current.currentTime = Number(event.currentTarget.value);
              }
            }}
          />
          <span>{formatTime(duration)}</span>
        </div>
        <div className="dock-volume">
          <button
            type="button"
            onClick={toggleMute}
            disabled={!item?.media}
            aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
          >
            <span aria-hidden="true">{isMuted || volume === 0 ? "🔇" : "🔊"}</span>
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
        <a className="dock-queue-link" href="#queue">
          Queue <span aria-hidden="true">☷</span>
        </a>
      </div>

      <div id="queue" className="queue-wrap">
        <Queue
          entries={queue}
          onClear={onClearQueue}
          onSelect={onSelectQueueEntry}
          onRemove={onRemoveQueueEntry}
        />
      </div>

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
