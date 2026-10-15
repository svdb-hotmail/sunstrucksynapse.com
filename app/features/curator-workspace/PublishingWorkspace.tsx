import { flushSync } from "react-dom";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { CuratorBadge, CuratorButton, CuratorPanel } from "./CuratorPrimitives";
import type { AlbumReadiness } from "~/repositories/album-publishing.server";
import { MultiSelect } from "~/components/MultiSelect";
import { GENRES, MOODS, PROCESS_TAGS } from "~/config/music-metadata";
import type { AlbumTrackInput } from "~/repositories/album-publishing.server";

export interface PreparedTrack {
  id: string;
  title: string;
  position: number;
  genre: string;
  genres?: string[];
  moods: string[];
  processTags: string[];
  preparationStatus: string | null;
  coverId: string | null;
  submissionId?: string | null;
  failureCode: string | null;
}
export function PublishingWorkspace({
  title,
  artistName,
  releaseKind,
  tracks,
  readiness,
  encodingAvailable,
  pending = false,
  error,
  publicUrl,
  coverPreviewUrl,
  onPublish,
  onRetry,
  onRefresh,
  onSaveMetadata,
  onReorder,
  revisionKey,
}: {
  title: string;
  artistName: string;
  releaseKind: "single" | "album";
  tracks: PreparedTrack[];
  readiness: AlbumReadiness[];
  encodingAvailable: boolean;
  pending?: boolean;
  error?: string;
  publicUrl?: string;
  coverPreviewUrl?: string;
  onPublish: () => void;
  onRetry: (id: string) => void;
  onRefresh: () => void;
  onSaveMetadata?: (tracks: AlbumTrackInput[]) => void;
  onReorder?: (ids: string[]) => void;
  revisionKey?: string;
}) {
  const [confirmedRevision, setConfirmedRevision] = useState<string | null>(null);
  const revision = JSON.stringify([
    revisionKey,
    title,
    artistName,
    releaseKind,
    tracks.map((t) => [
      t.id,
      t.title,
      t.position,
      t.coverId,
      t.genres,
      t.moods,
      t.processTags,
      t.preparationStatus,
    ]),
  ]);
  const confirmed = confirmedRevision === revision;
  const [listening, setListening] = useState<string | null>(null);
  const [audioError, setAudioError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const selectedTrack =
    tracks.find((t) => t.id === listening && t.preparationStatus === "ready") ??
    tracks.find((t) => t.preparationStatus === "ready");
  const blockers = readiness.flatMap((row) =>
    row.blockers.map((blocker) => ({ title: row.title, blocker })),
  );
  const ready = Boolean(
    tracks.length &&
      !blockers.length &&
      tracks.every((t) => t.preparationStatus === "ready" && t.coverId),
  );
  const cover = tracks[0]?.coverId;
  const missingMetadata = tracks.some((t) => !t.genre || !t.moods.length || !t.processTags.length);
  const needsAttention =
    tracks.some((t) => !t.coverId || t.preparationStatus === "failed") || missingMetadata;
  if (publicUrl)
    return (
      <CuratorPanel className="publishing-complete">
        <CuratorBadge tone="success">Published</CuratorBadge>
        <h1>{title}</h1>
        <p>Your {releaseKind} is available for listening.</p>
        <Link to={publicUrl}>Open published release →</Link>
        <p>
          <Link to="/curator/submissions">Continue curating</Link>
        </p>
      </CuratorPanel>
    );
  return (
    <>
      <header className="curator-page-heading">
        <div>
          <p className="curator-overline">Accepted · {releaseKind}</p>
          <h1>{title}</h1>
          <p>
            {artistName} · {tracks.length} track{tracks.length === 1 ? "" : "s"}
          </p>
        </div>
        <CuratorBadge tone={ready ? "success" : needsAttention ? "warning" : "info"}>
          {ready ? "Ready to publish" : needsAttention ? "Needs attention" : "In preparation"}
        </CuratorBadge>
      </header>
      {error ? (
        <p className="publishing-message" role="alert">
          {error}
        </p>
      ) : null}
      {!encodingAvailable && tracks.some((t) => t.preparationStatus !== "ready") ? (
        <p role="status" className="publishing-message">
          Automatic preparation is temporarily unavailable. Your accepted music is saved in this
          queue.
        </p>
      ) : null}
      <div className="publishing-layout">
        <CuratorPanel className="publishing-editor">
          <h2>Release preparation</h2>
          <p>
            Check the release details and cover. SunSyn prepares the streaming files automatically.
          </p>
          <audio
            ref={audio}
            controls
            src={selectedTrack ? `/curator/prepared-audio/${selectedTrack.id}` : undefined}
            preload="metadata"
            aria-label="Private streaming preview"
            onError={() =>
              setAudioError("Streaming preview unavailable. Refresh preparation and retry.")
            }
          />
          {audioError ? <p role="alert">{audioError}</p> : null}
          <ol className="publishing-track-list">
            {tracks.map((track, index) => (
              <li key={track.id}>
                <div className="publishing-track-heading">
                  <span className="publishing-number">{track.position}</span>
                  <strong>{track.title}</strong>
                  <CuratorBadge
                    tone={
                      track.preparationStatus === "ready"
                        ? "success"
                        : track.preparationStatus === "failed" || !track.coverId
                          ? "warning"
                          : "info"
                    }
                  >
                    {!track.coverId
                      ? "Cover needed"
                      : track.preparationStatus === "ready"
                        ? "Ready"
                        : track.preparationStatus === "failed"
                          ? "Needs attention"
                          : "Preparing"}
                  </CuratorBadge>
                </div>
                <p>
                  {(track.genres?.length ? track.genres : [track.genre]).filter(Boolean).join(", ")}{" "}
                  · {track.moods.join(", ")}
                </p>
                <small>{track.processTags.join(", ")}</small>
                {track.submissionId ? (
                  <p>
                    <Link to={`/curator/submissions/${track.submissionId}/edit`}>
                      Edit artwork and details →
                    </Link>
                  </p>
                ) : null}
                {releaseKind === "album" && onReorder ? (
                  <div>
                    <CuratorButton
                      variant="ghost"
                      disabled={pending || index === 0}
                      aria-label={`Move ${track.title} up`}
                      onClick={() => {
                        const ids = tracks.map((t) => t.id);
                        [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                        onReorder(ids);
                      }}
                    >
                      Move up
                    </CuratorButton>
                    <CuratorButton
                      variant="ghost"
                      disabled={pending || index === tracks.length - 1}
                      aria-label={`Move ${track.title} down`}
                      onClick={() => {
                        const ids = tracks.map((t) => t.id);
                        [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
                        onReorder(ids);
                      }}
                    >
                      Move down
                    </CuratorButton>
                  </div>
                ) : null}
                {track.preparationStatus === "ready" ? (
                  <CuratorButton
                    variant="ghost"
                    onClick={() => {
                      const element = audio.current;
                      if (!element) return;
                      setAudioError("");
                      if (selectedTrack?.id === track.id && !element.paused) {
                        element.pause();
                        return;
                      }
                      // Commit the selected source before play(), retaining the
                      // user gesture required by mobile browsers.
                      if (selectedTrack?.id !== track.id) flushSync(() => setListening(track.id));
                      void element
                        .play()
                        .catch(() => setAudioError("Preview could not play. Try again."));
                    }}
                  >
                    Audition {track.title}
                  </CuratorButton>
                ) : null}
                {track.failureCode ? (
                  <p role="status">
                    Preparation was interrupted. The original remains saved.
                    {track.preparationStatus !== "failed"
                      ? " A retry is queued automatically."
                      : " Retry preparation or ask the operator to investigate."}
                  </p>
                ) : null}
                {track.preparationStatus === "failed" ? (
                  <CuratorButton
                    disabled={pending || !encodingAvailable}
                    onClick={() => onRetry(track.id)}
                  >
                    Retry preparation
                  </CuratorButton>
                ) : null}
              </li>
            ))}
          </ol>
          {onReorder && tracks.some((t, index) => t.position !== index + 1) ? (
            <p className="publishing-message">
              Some submitted tracks did not enter this release. Keep this order and number the
              remaining tracks from 1.
              <CuratorButton disabled={pending} onClick={() => onReorder(tracks.map((t) => t.id))}>
                Close gaps in track numbers
              </CuratorButton>
            </p>
          ) : null}
          {tracks.some((t) => !t.coverId) ? (
            <p className="publishing-message">
              Artwork is still needed. Open Edit artwork and details to add it, or ask the artist to
              use their original invitation. The accepted review stays unchanged.
            </p>
          ) : null}
          {missingMetadata && onSaveMetadata ? (
            <details open>
              <summary>Complete details from earlier submissions</summary>
              <p>
                New submissions supply these choices before review. Choose the missing discovery
                details once for these earlier tracks.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  onSaveMetadata(
                    tracks.map((t) => {
                      const genres = data.getAll(`${t.id}.genres`).map(String);
                      return {
                        id: t.id,
                        title: t.title,
                        genre: genres[0] ?? "",
                        genres,
                        moods: data.getAll(`${t.id}.moods`).map(String),
                        processTags: data.getAll(`${t.id}.processTags`).map(String),
                      };
                    }),
                  );
                }}
              >
                {tracks.map((t) => (
                  <fieldset key={t.id} disabled={pending}>
                    <legend>{t.title}</legend>
                    <MultiSelect
                      name={`${t.id}.genres`}
                      label="Genres"
                      options={GENRES}
                      defaultValue={t.genres?.length ? t.genres : [t.genre].filter(Boolean)}
                    />
                    <MultiSelect
                      name={`${t.id}.moods`}
                      label="Moods"
                      options={MOODS}
                      defaultValue={t.moods}
                    />
                    <MultiSelect
                      name={`${t.id}.processTags`}
                      label="Creative process tags"
                      options={PROCESS_TAGS}
                      defaultValue={t.processTags}
                    />
                  </fieldset>
                ))}
                <CuratorButton disabled={pending} type="submit">
                  Save discovery details
                </CuratorButton>
              </form>
            </details>
          ) : null}
          {blockers.length ? (
            <section className="publishing-blockers">
              <h3>Before publication</h3>
              <ul>
                {blockers.map((row, index) => (
                  <li key={`${row.title}:${row.blocker}:${index}`}>
                    <strong>{row.title}:</strong> {row.blocker}
                  </li>
                ))}
              </ul>
              <CuratorButton disabled={pending} onClick={onRefresh}>
                Refresh preparation
              </CuratorButton>
            </section>
          ) : (
            <p className="publishing-message" role="status">
              All publication checks pass.
            </p>
          )}
          <footer className="publishing-actions">
            <Link to="/curator/submissions">Keep curating →</Link>
            <p>Preparation stays saved in Publishing.</p>
          </footer>
        </CuratorPanel>
        <aside className="publishing-summary" aria-label="Public presentation">
          <CuratorPanel>
            <div className="publishing-cover">
              {cover ? (
                <img
                  src={coverPreviewUrl ?? `/curator/submission-covers/${cover}`}
                  alt={`${title} release cover`}
                />
              ) : (
                <span>Cover needed</span>
              )}
            </div>
            <h2>{title}</h2>
            <p>{artistName}</p>
            <ol>
              {tracks.map((track) => (
                <li key={track.id}>{track.title}</li>
              ))}
            </ol>
            <label className="publishing-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={pending || !ready}
                onChange={(e) => setConfirmedRevision(e.currentTarget.checked ? revision : null)}
              />
              {releaseKind === "album"
                ? "The album track list is complete. Publish this album and its tracks."
                : "Publish this single for public listening."}
            </label>
            <CuratorButton
              variant="primary"
              disabled={pending || !ready || !confirmed}
              onClick={onPublish}
            >
              {pending ? "Saving…" : `Publish ${releaseKind}`}
            </CuratorButton>
            <p>Private originals and review records stay private. Publication is recorded once.</p>
          </CuratorPanel>
        </aside>
      </div>
    </>
  );
}
