import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { CuratorBadge, CuratorButton } from "./CuratorPrimitives";
import type { CuratorReviewView } from "./types";

export type ReviewCriterion =
  | "artisticQuality"
  | "originalityIntent"
  | "productionReadiness"
  | "editorialFit";
export type ReviewGrade = "A" | "B" | "C";
export type ReviewScores = Record<ReviewCriterion, number | null>;
type ReviewContextTab = "metadata" | "rights" | "activity" | "files";

const criteria: Array<{ id: ReviewCriterion; label: string; help: string }> = [
  { id: "artisticQuality", label: "Artistic quality", help: "Composition, sound, and execution" },
  { id: "originalityIntent", label: "Originality & intent", help: "Distinctive and intentional" },
  { id: "productionReadiness", label: "Production readiness", help: "Technical and mix quality" },
  { id: "editorialFit", label: "Editorial fit", help: "Belongs on SunSyn Radio" },
];

const grades: Array<{ id: ReviewGrade; label: string }> = [
  { id: "A", label: "Accept with distinction" },
  { id: "B", label: "Accept" },
  { id: "C", label: "Decline" },
];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function isTextEntry(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function ReviewWorkspace({
  grade,
  notice,
  rationale,
  review,
  scores,
  onAskArtist,
  onFinish,
  onGrade,
  onLater,
  onRationale,
  onScore,
}: {
  grade: ReviewGrade | null;
  notice?: string | null;
  rationale: string;
  review: CuratorReviewView;
  scores: ReviewScores;
  onAskArtist: (claimKey: string, question: string) => void;
  onFinish: () => void;
  onGrade: (grade: ReviewGrade) => void;
  onLater: () => void;
  onRationale: (value: string) => void;
  onScore: (criterion: ReviewCriterion, score: number) => void;
}) {
  const [activeCriterion, setActiveCriterion] = useState<ReviewCriterion>("artisticQuality");
  const [activeTab, setActiveTab] = useState<ReviewContextTab>("metadata");
  const [clarificationOpen, setClarificationOpen] = useState(false);
  const [clarificationField, setClarificationField] = useState("rights.authorityBasis");
  const [clarificationQuestion, setClarificationQuestion] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const durationSeconds = (review.submission.durationMs ?? 0) / 1000;
  const complete =
    Object.values(scores).every((score) => score !== null) &&
    grade !== null &&
    rationale.trim().length > 0;

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !review.submission.audioUrl) return;
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [review.submission.audioUrl]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isTextEntry(event.target)) return;
      if (event.key === " ") {
        event.preventDefault();
        void togglePlayback();
      } else if (/^[1-5]$/.test(event.key)) {
        onScore(activeCriterion, Number(event.key));
      } else if (/^[abc]$/i.test(event.key)) {
        onGrade(event.key.toUpperCase() as ReviewGrade);
      } else if (event.key.toLowerCase() === "q") {
        setClarificationOpen(true);
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && complete) {
        onFinish();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeCriterion, complete, onFinish, onGrade, onScore, togglePlayback]);

  const seek = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.stopPropagation();
  };

  return (
    <div className="curator-review-layout">
      <section className="curator-review" aria-labelledby="curator-review-title">
        {notice ? (
          <p className="curator-review__notice" role="status">
            {notice}
          </p>
        ) : null}
        <header className="curator-review__heading">
          <div className="curator-artwork curator-review__artwork" aria-hidden="true">
            <span>{review.submission.artistName.slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <div className="curator-review__status">
              <CuratorBadge tone="success">Ready</CuratorBadge>
              <span>{review.submission.publicReference}</span>
            </div>
            <h1 id="curator-review-title">{review.submission.title}</h1>
            <p>{review.submission.artistName}</p>
            <small>Submitted for private editorial review</small>
          </div>
        </header>

        <div className="curator-review-player">
          <audio
            ref={audioRef}
            src={review.submission.audioUrl ?? undefined}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          />
          <button
            type="button"
            className="curator-review-player__play"
            aria-label={isPlaying ? "Pause review audio" : "Play review audio"}
            disabled={!review.submission.audioUrl}
            onClick={() => void togglePlayback()}
          >
            {isPlaying ? "Ⅱ" : "▶"}
          </button>
          <div>
            <input
              type="range"
              min="0"
              max={durationSeconds || 1}
              step="1"
              value={Math.min(currentTime, durationSeconds || 1)}
              aria-label="Review audio position"
              onKeyDown={seek}
              onChange={(event) => {
                const nextTime = Number(event.currentTarget.value);
                if (audioRef.current) audioRef.current.currentTime = nextTime;
                setCurrentTime(nextTime);
              }}
            />
            <p>
              {formatTime(currentTime)} / {formatTime(durationSeconds)}
            </p>
          </div>
          <span>Private listening copy</span>
        </div>

        <section className="curator-review__assessment" aria-labelledby="review-assessment-heading">
          <div>
            <p className="curator-overline">Listen · assess · decide</p>
            <h2 id="review-assessment-heading">Review & scoring</h2>
            <div className="curator-score-list">
              {criteria.map((criterion) => (
                <fieldset
                  key={criterion.id}
                  className={activeCriterion === criterion.id ? "is-active" : undefined}
                  onFocus={() => setActiveCriterion(criterion.id)}
                >
                  <legend>
                    <strong>{criterion.label}</strong>
                    <small>{criterion.help}</small>
                  </legend>
                  <div>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <label key={score}>
                        <input
                          type="radio"
                          name={criterion.id}
                          value={score}
                          checked={scores[criterion.id] === score}
                          onChange={() => onScore(criterion.id, score)}
                        />
                        <span>{score}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
          <div className="curator-decision">
            <h2>Grade</h2>
            <div className="curator-grade-options">
              {grades.map((option) => (
                <label key={option.id} title={option.label}>
                  <input
                    type="radio"
                    name="grade"
                    value={option.id}
                    checked={grade === option.id}
                    onChange={() => onGrade(option.id)}
                  />
                  <span>{option.id}</span>
                </label>
              ))}
            </div>
            <label className="curator-decision__rationale">
              Decision rationale
              <textarea
                rows={5}
                maxLength={8000}
                value={rationale}
                placeholder="Capture the reason for your editorial decision…"
                onChange={(event) => onRationale(event.currentTarget.value)}
              />
              <small>{rationale.length}/8000 · saved in this prototype</small>
            </label>
          </div>
        </section>

        <footer className="curator-review__actions">
          <div>
            <CuratorButton variant="secondary" onClick={() => setClarificationOpen(true)}>
              Ask artist
            </CuratorButton>
            <CuratorButton variant="ghost" onClick={onLater}>
              Later
            </CuratorButton>
          </div>
          <CuratorButton variant="primary" disabled={!complete} onClick={onFinish}>
            Finish & next →
          </CuratorButton>
        </footer>
        <p className="curator-shortcuts">
          <kbd>Space</kbd> Play/pause · <kbd>1–5</kbd> Score · <kbd>A B C</kbd> Grade ·<kbd> Q</kbd>{" "}
          Ask artist · <kbd>Ctrl Enter</kbd> Finish
        </p>
      </section>

      <aside className="curator-review-context" aria-label="Submission context">
        <div className="curator-review-context__tabs" role="tablist" aria-label="Review context">
          {(["metadata", "rights", "activity", "files"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeTab === "metadata" ? (
          <div className="curator-review-context__content">
            <h2>Track information</h2>
            <dl>
              <div>
                <dt>Artist</dt>
                <dd>{review.submission.artistName}</dd>
              </div>
              <div>
                <dt>Track</dt>
                <dd>{review.submission.title}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{review.submission.submitterEmail}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{review.artistLocation}</dd>
              </div>
            </dl>
            <h3>Artist context</h3>
            <p>{review.artistBiography}</p>
            <h3>Creative contribution</h3>
            <p>{review.creativeContribution}</p>
            <h3>Disclosed AI tools</h3>
            <p>{review.aiTools.join(", ")}</p>
          </div>
        ) : null}
        {activeTab === "rights" ? (
          <div className="curator-review-context__content">
            <h2>Rights attestation</h2>
            <p>{review.rightsSummary}</p>
            <h3>Territories</h3>
            <p>{review.territories.join(", ")}</p>
            <h3>Provenance</h3>
            <p>{review.provenanceSummary}</p>
          </div>
        ) : null}
        {activeTab === "activity" ? (
          <ol className="curator-review-context__timeline">
            {review.activities.map((activity) => (
              <li key={activity.id}>
                <strong>{activity.label}</strong>
                <small>{new Date(activity.timestamp).toLocaleString()}</small>
              </li>
            ))}
          </ol>
        ) : null}
        {activeTab === "files" ? (
          <ul className="curator-review-context__files">
            {review.files.map((file) => (
              <li key={file.id}>
                <strong>{file.filename}</strong>
                <small>{file.detail}</small>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>

      {clarificationOpen ? (
        <div className="curator-dialog-backdrop" role="presentation">
          <section
            className="curator-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clarification-title"
          >
            <h2 id="clarification-title">Ask the artist</h2>
            <p>Request only the information needed to continue this review.</p>
            <label>
              Subject
              <select
                value={clarificationField}
                onChange={(event) => setClarificationField(event.currentTarget.value)}
              >
                <option value="rights.authorityBasis">Rights basis</option>
                <option value="rights.thirdPartyMaterial">Third-party material</option>
                <option value="process.aiTools">AI tools and process</option>
                <option value="provenance.sources">Source provenance</option>
              </select>
            </label>
            <label>
              Question
              <textarea
                rows={4}
                value={clarificationQuestion}
                onChange={(event) => setClarificationQuestion(event.currentTarget.value)}
              />
            </label>
            <footer>
              <CuratorButton variant="ghost" onClick={() => setClarificationOpen(false)}>
                Cancel
              </CuratorButton>
              <CuratorButton
                variant="primary"
                disabled={!clarificationQuestion.trim()}
                onClick={() => {
                  onAskArtist(clarificationField, clarificationQuestion.trim());
                  setClarificationQuestion("");
                  setClarificationOpen(false);
                }}
              >
                Send question & next →
              </CuratorButton>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
