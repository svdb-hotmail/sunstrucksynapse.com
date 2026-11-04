import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "./upstream/Button";
import { MediaButton } from "./upstream/MediaButton";
import { Notice } from "./upstream/Notice";
import "./upstream/palette.css";
import "./upstream/theme.css";
import "./upstream/brand.css";
import "./upstream/components.css";
import "./upstream/notices.css";
import "./mockup.css";

type Track = { id: number; title: string; subtitle: string; file: string; art: string };
const tracks: Track[] = [
  {
    id: 1,
    title: "Sunstruck Synapse",
    subtitle: "Revolution will be televised",
    file: "Sunstruck Synapse (Revolution will be televised).mp3",
    art: "signal",
  },
  {
    id: 2,
    title: "The Mushroom Circle",
    subtitle: "Gnome Revolution",
    file: "The Mushroom Circle (Gnome Revolution).mp3",
    art: "bloom",
  },
];
type IconName =
  | "play"
  | "pause"
  | "next"
  | "back"
  | "queue"
  | "search"
  | "close"
  | "plus"
  | "arrow"
  | "headphones"
  | "volume"
  | "check";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    play: <path d="m9 5 11 7-11 7Z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    next: (
      <>
        <path d="m5 5 11 7-11 7ZM19 5v14" />
      </>
    ),
    back: (
      <>
        <path d="m19 5-11 7 11 7ZM5 5v14" />
      </>
    ),
    queue: (
      <>
        <path d="M4 6h16M4 12h11M4 18h8m6-3 4 3-4 3Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    headphones: (
      <>
        <path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13h4v8H4zM16 13h4v8h-4z" />
      </>
    ),
    volume: (
      <>
        <path d="m11 5-6 5H2v4h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Artwork({ track, className = "" }: { track: Track; className?: string }) {
  return (
    <div
      className={`artwork artwork--${track.art} ${className}`}
      role="img"
      aria-label={`Illustrative mockup artwork for ${track.title}`}
    >
      <div className="artwork-orbit" />
      <div className="artwork-core" />
      <span>SS / {String(track.id).padStart(2, "0")}</span>
    </div>
  );
}
function time(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

function App() {
  const [page, setPage] = useState("Listen");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Track[]>([]);
  const [detail, setDetail] = useState<Track | null>(null);
  const [message, setMessage] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  async function start(track: Track) {
    if (!audio.current) return;
    setMessage("");
    if (active?.id !== track.id) {
      audio.current.src = `/assets/audio/${encodeURIComponent(track.file)}`;
      setActive(track);
      setPosition(0);
      setDuration(0);
    }
    try {
      await audio.current.play();
    } catch {
      setMessage("Playback could not start. Try playing the track again.");
    }
  }
  function toggle() {
    if (playing) audio.current?.pause();
    else if (active) void start(active);
  }
  function next() {
    const track = queue[0];
    if (track) {
      setQueue(queue.slice(1));
      void start(track);
    } else {
      audio.current?.pause();
      setMessage("You’ve reached the end of your queue. Explore something new.");
    }
  }
  function enqueue(track: Track) {
    if (queue.some((item) => item.id === track.id)) {
      setMessage(`${track.title} is already in your queue.`);
      return;
    }
    setQueue([...queue, track]);
    setMessage(`Added ${track.title} to your queue.`);
  }
  function openDetail(track: Track) {
    setDetail(track);
    dialog.current?.showModal();
  }
  function row(track: Track, index: number, queued = false) {
    return (
      <div className="track-row" key={track.id}>
        <span className="track-number">{String(index + 1).padStart(2, "0")}</span>
        <Artwork track={track} />
        <button className="track-title" onClick={() => openDetail(track)}>
          <strong>{track.title}</strong>
          <span>Sunstruck Synapse · {track.subtitle}</span>
        </button>
        <span className="track-format">AUDIO</span>
        <MediaButton
          media="audio"
          emphasis="quiet"
          iconOnly
          aria-label={
            active?.id === track.id && playing ? `Pause ${track.title}` : `Play ${track.title}`
          }
          onClick={() => (active?.id === track.id && playing ? toggle() : void start(track))}
        >
          <Icon name={active?.id === track.id && playing ? "pause" : "play"} />
        </MediaButton>
        <Button
          aria-label={`${queued ? "Remove" : "Queue"} ${track.title}`}
          onClick={() =>
            queued ? setQueue(queue.filter((item) => item.id !== track.id)) : enqueue(track)
          }
        >
          <Icon name={queued ? "close" : "plus"} />
        </Button>
      </div>
    );
  }
  return (
    <div className="kb-preview sunsyn-mockup" data-theme="dark">
      <a className="skip-link" href="#main">
        Skip to music
      </a>
      <header className="brand-topbar masthead">
        <button
          className="wordmark"
          onClick={() => setPage("Listen")}
          aria-label="SunSyn Radio home"
        >
          <span className="brand-icon-badge station-mark">
            <Icon name="headphones" size={22} />
          </span>
          <span className="brand-display brand-gradient-text">
            SUNSYN<span className="wordmark-radio">RADIO</span>
          </span>
        </button>
        <nav aria-label="Main navigation">
          {["Listen", "Explore", "Queue"].map((item) => (
            <button
              key={item}
              aria-current={page === item ? "page" : undefined}
              onClick={() => {
                setPage(item);
                setMessage("");
              }}
            >
              {item}
              {item === "Queue" && queue.length > 0 ? (
                <span className="nav-count">{queue.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <span className="preview-label">
          Design preview <span>SDP–2</span>
        </span>
      </header>
      <main id="main" className="main-content">
        <div className="page-kicker">
          <span className="signal-dot" /> HUMAN-CURATED. AI-ASSISTED.{" "}
          <span className="edition">MUSIC MADE WITH INTENT</span>
        </div>
        {page === "Listen" ? (
          <>
            <section className="listening-hero brand-panel">
              <div className="hero-copy">
                <span className="section-label">A space for intentional sound</span>
                <h1 className="brand-display">
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
                    onClick={() => {
                      setQueue(tracks.slice(1));
                      void start(tracks[0]);
                    }}
                  >
                    <Icon name="play" /> Start listening
                  </MediaButton>
                  <Button onClick={() => setPage("Explore")}>
                    Explore the music <Icon name="arrow" size={17} />
                  </Button>
                </div>
                <span className="hero-footnote">
                  Plays the selection in order · replaces your queue
                </span>
              </div>
              <div className="hero-visual" aria-hidden="true">
                <div className="frequency-ring ring-1" />
                <div className="frequency-ring ring-2" />
                <div className="frequency-ring ring-3" />
                <div className="frequency-ring ring-4" />
                <div className="frequency-core" />
                <div className="frequency-bars">
                  {Array.from({ length: 39 }, (_, i) => (
                    <i key={i} style={{ height: `${18 + Math.sin(i * 1.7) ** 2 * 62}px` }} />
                  ))}
                </div>
                <span className="visual-caption">A DIFFERENT KIND OF SIGNAL</span>
              </div>
            </section>
            <div className="content-layout">
              <section className="track-section">
                <div className="section-heading">
                  <div>
                    <span className="section-label">The listening room</span>
                    <h2 className="brand-display">In rotation</h2>
                  </div>
                  <button className="text-action" onClick={() => setPage("Explore")}>
                    Explore all <Icon name="arrow" size={16} />
                  </button>
                </div>
                <div className="track-list">{tracks.map((track, index) => row(track, index))}</div>
                <p className="muted collection-note">Two tracks. Two worlds. One curious mind.</p>
              </section>
              <aside className="curator-note brand-panel-soft">
                <span className="note-symbol">✦</span>
                <span className="section-label">The SunSyn idea</span>
                <h2>
                  Tools make possibilities.
                  <br />
                  People make choices.
                </h2>
                <p>
                  AI is part of the process. Human intention is the point. Every selection starts
                  with listening.
                </p>
                <span className="note-signature">
                  Curated with care <Icon name="check" size={15} />
                </span>
              </aside>
            </div>
            <section className="release-section">
              <div className="section-heading">
                <div>
                  <span className="section-label">Go a little deeper</span>
                  <h2 className="brand-display">Discover the sound</h2>
                </div>
                <span className="muted">Sunstruck Synapse</span>
              </div>
              <div className="release-grid">
                {tracks.map((track) => (
                  <button
                    className="release-card brand-card"
                    key={track.id}
                    onClick={() => openDetail(track)}
                  >
                    <Artwork track={track} />
                    <div>
                      <span className="section-label">Featured track</span>
                      <h3>{track.title}</h3>
                      <p>{track.subtitle}</p>
                      <span className="release-link">
                        Listen & discover <Icon name="arrow" size={17} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="browser-page">
            <span className="section-label">
              {page === "Queue" ? "Your next frequencies" : "Follow your curiosity"}
            </span>
            <div className="section-heading">
              <h1 className="brand-display">
                {page === "Queue" ? "Up next" : "Explore the music"}
              </h1>
              {page === "Queue" && queue.length > 0 ? (
                <Button onClick={() => setQueue([])}>Clear queue</Button>
              ) : null}
            </div>
            {page === "Explore" ? (
              <label className="search-box">
                <Icon name="search" />
                <input
                  className="brand-input"
                  placeholder="Search tracks or artists…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  type="search"
                  aria-label="Search tracks or artists"
                />
              </label>
            ) : null}
            <div className="track-list">
              {(page === "Queue"
                ? queue
                : tracks.filter((track) =>
                    `${track.title} ${track.subtitle} Sunstruck Synapse`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
              ).map((track, index) => row(track, index, page === "Queue"))}
            </div>
            {page === "Queue" && queue.length === 0 ? (
              <div className="empty-state brand-panel-soft">
                <Icon name="queue" size={36} />
                <h2>Leave room for discovery.</h2>
                <p>Your queue is empty. Add a track and shape your own listening session.</p>
                <MediaButton media="audio" onClick={() => setPage("Explore")}>
                  Find your next track <Icon name="arrow" />
                </MediaButton>
              </div>
            ) : null}
            {page === "Explore" &&
            !tracks.some((track) =>
              `${track.title} ${track.subtitle} Sunstruck Synapse`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) ? (
              <div className="empty-state">
                <h2>No matching frequencies.</h2>
                <p>Try a different title or artist.</p>
                <Button onClick={() => setQuery("")}>Clear search</Button>
              </div>
            ) : null}
          </section>
        )}
        {message ? <Notice>{message}</Notice> : null}
        <footer className="site-footer">
          <span className="brand-display">SUNSYN RADIO</span>
          <span>Independent sound. Human selection.</span>
          <small>Interactive mockup · illustrative artwork and editorial copy</small>
        </footer>
      </main>
      <section className="transport brand-topbar" aria-label="Music player">
        <div className="transport-track">
          {active ? (
            <Artwork track={active} />
          ) : (
            <span className="idle-art">
              <Icon name="headphones" />
            </span>
          )}
          <div>
            <strong>{active?.title ?? "Find your next frequency"}</strong>
            <span>{active ? "Sunstruck Synapse" : "Select a track to start listening"}</span>
          </div>
        </div>
        <div className="transport-center">
          <div className="transport-controls">
            <MediaButton
              media="audio"
              emphasis="quiet"
              iconOnly
              aria-label="Restart track"
              disabled={!active}
              onClick={() => {
                if (audio.current) audio.current.currentTime = 0;
              }}
            >
              <Icon name="back" size={17} />
            </MediaButton>
            <MediaButton
              media="audio"
              emphasis="primary"
              iconOnly
              aria-label={playing ? "Pause playback" : "Start playback"}
              onClick={() => (active ? toggle() : void start(tracks[0]))}
            >
              <Icon name={playing ? "pause" : "play"} size={20} />
            </MediaButton>
            <MediaButton
              media="audio"
              emphasis="quiet"
              iconOnly
              aria-label="Next queued track"
              disabled={!queue.length}
              onClick={next}
            >
              <Icon name="next" size={17} />
            </MediaButton>
          </div>
          <div className="timeline">
            <span>{time(position)}</span>
            <input
              type="range"
              min="0"
              max={duration || 1}
              step="0.1"
              value={position}
              disabled={!duration}
              aria-label="Playback position"
              onChange={(event) => {
                if (audio.current) audio.current.currentTime = Number(event.target.value);
              }}
            />
            <span>{time(duration)}</span>
          </div>
        </div>
        <div className="transport-tools">
          <label className="volume-control">
            <Icon name="volume" size={18} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              defaultValue="1"
              aria-label="Volume"
              onChange={(event) => {
                if (audio.current) audio.current.volume = Number(event.target.value);
              }}
            />
          </label>
          <Button
            onClick={() => setPage("Queue")}
            aria-label={`Open queue, ${queue.length} tracks`}
          >
            <Icon name="queue" />
            <span>{queue.length}</span>
          </Button>
        </div>
      </section>
      <audio
        ref={audio}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)}
        onLoadedMetadata={() =>
          setDuration(Number.isFinite(audio.current?.duration) ? audio.current!.duration : 0)
        }
        onEnded={next}
        onError={() => {
          setPlaying(false);
          setMessage("This recording could not load. Please try again.");
        }}
      />
      <dialog
        ref={dialog}
        className="track-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        aria-labelledby="detail-title"
      >
        <div className="dialog-heading">
          <span className="section-label">Inside the sound</span>
          <Button onClick={() => dialog.current?.close()} aria-label="Close track details">
            <Icon name="close" />
          </Button>
        </div>
        {detail ? (
          <>
            <Artwork track={detail} />
            <span className="section-label">Sunstruck Synapse</span>
            <h2 id="detail-title" className="brand-display">
              {detail.title}
            </h2>
            <p>{detail.subtitle}</p>
            <p className="muted">
              A track from the existing SunSyn catalogue. Artwork and presentation are created for
              this design preview.
            </p>
            <div className="hero-actions">
              <MediaButton media="audio" emphasis="primary" onClick={() => void start(detail)}>
                <Icon name="play" /> Play track
              </MediaButton>
              <Button
                onClick={() => {
                  enqueue(detail);
                  dialog.current?.close();
                }}
              >
                <Icon name="plus" /> Add to queue
              </Button>
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
