import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { MultiSelect } from "~/components/MultiSelect";
import {
  COVER_MAX_BYTES,
  COVER_MIME_TYPES,
  COVER_MIN_PIXELS,
  GENRES,
  MOODS,
  PROCESS_TAGS,
} from "~/config/music-metadata";
import type { SubmissionEditView } from "~/types/submission-edit";
import { CuratorButton, CuratorPanel } from "./CuratorPrimitives";

// Preserve the full composition. Small legacy covers are resized, never cropped.
export async function prepareCuratorCover(file: File): Promise<File> {
  if (
    !COVER_MIME_TYPES.includes(file.type as (typeof COVER_MIME_TYPES)[number]) ||
    !file.size ||
    file.size > COVER_MAX_BYTES
  )
    throw new Error("Choose a JPG, PNG, WebP or AVIF cover, up to 20 MiB.");
  const image = await createImageBitmap(file);
  try {
    if (image.width !== image.height || image.width > 10000)
      throw new Error("Choose a square cover, no larger than 10000 × 10000 pixels.");
    if (image.width >= COVER_MIN_PIXELS) return file;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = COVER_MIN_PIXELS;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("Image resizing is unavailable. Choose a cover at least 1400 × 1400 pixels.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not resize the image."))),
        "image/png",
      ),
    );
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "-1400.png", { type: "image/png" });
  } finally {
    image.close();
  }
}

export function SubmissionEditor({
  data,
  pending = false,
  error,
  savedRevision,
  savedCoverUrl,
  onSave,
}: {
  data: SubmissionEditView;
  pending?: boolean;
  error?: string;
  savedRevision?: string;
  savedCoverUrl?: string | null;
  onSave: (form: FormData) => void;
}) {
  const [revision, setRevision] = useState(data.revision);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [permission, setPermission] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (savedRevision) {
      setRevision(savedRevision);
      setFile(null);
      setPermission(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }, [savedRevision]);
  useEffect(() => {
    if (!data.editable) {
      setFile(null);
      setPermission(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }, [data.editable]);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const coverUrl = (data.editable ? preview : null) ?? savedCoverUrl ?? data.coverUrl;
  const busy = pending || preparing;
  const discoveryEditable = data.editable || data.discoveryEditable === true;
  const canSave = data.editable || discoveryEditable;
  return (
    <>
      <header className="curator-page-heading">
        <div>
          <p className="curator-overline">
            {data.reference} · {data.status}
          </p>
          <h1>
            {data.editable
              ? "Edit artwork and details"
              : discoveryEditable
                ? "Edit discovery details"
                : "Read-only submission"}
          </h1>
          <p>
            {data.artistName} · {data.fields.title}
          </p>
        </div>
      </header>
      <p>
        Corrections are recorded with your name and reason. The artist’s original submission and
        accepted review remain in history.
      </p>
      {error || localError ? (
        <p role="alert" className="publishing-message">
          {localError || error}
        </p>
      ) : null}
      {savedRevision && !error && !localError ? (
        <p role="status" className="publishing-message">
          Changes saved. Continue curating or return to publishing.
        </p>
      ) : null}
      {!data.editable ? (
        <CuratorPanel>
          <p>
            {discoveryEditable
              ? "You can correct genres, moods and process tags. Artwork, track title and release details are read-only. Give a reason when saving your corrections."
              : "This submission is closed or already published. Its details are read-only."}
          </p>
        </CuratorPanel>
      ) : null}
      <form
        className="curator-submission-editor"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setLocalError("");
          setPreparing(true);
          try {
            form.set("revision", revision);
            if (data.editable && file) form.set("cover", await prepareCuratorCover(file));
            else form.delete("cover");
            onSave(form);
          } catch (e) {
            setLocalError(e instanceof Error ? e.message : "Could not prepare this image.");
          } finally {
            setPreparing(false);
          }
        }}
      >
        <fieldset disabled={busy || !canSave}>
          <CuratorPanel>
            <h2>Artwork</h2>
            {coverUrl ? (
              <img className="curator-edit-cover" src={coverUrl} alt="Release cover preview" />
            ) : (
              <p>No cover supplied.</p>
            )}
            <label>
              Choose or replace cover
              <input
                type="file"
                disabled={!data.editable}
                ref={coverInput}
                name="cover"
                accept={COVER_MIME_TYPES.join(",")}
                onChange={(e) => {
                  setFile(e.currentTarget.files?.[0] ?? null);
                  setPermission(false);
                }}
              />
            </label>
            <p>
              Square JPG, PNG, WebP or AVIF, up to 20 MiB and 10000 × 10000 pixels. 3000 × 3000
              recommended. Smaller square images resize to 1400 × 1400 without cropping.
            </p>
            {data.releaseId ? (
              <p>The cover applies to all accepted tracks in this release.</p>
            ) : null}
            <label>
              <input
                type="checkbox"
                name="artworkPermission"
                disabled={!data.editable}
                checked={permission}
                onChange={(e) => setPermission(e.currentTarget.checked)}
                value="yes"
                required={data.editable && Boolean(file)}
              />{" "}
              I have permission to publish this artwork.
            </label>
          </CuratorPanel>
          <CuratorPanel>
            <h2>Track and release</h2>
            <label>
              Track title
              <input
                name="title"
                readOnly={!data.editable}
                defaultValue={data.fields.title}
                required
                maxLength={200}
              />
            </label>
            <label>
              Release title
              <input
                name="releaseTitle"
                readOnly={!data.editable || data.releaseFieldsEditable === false}
                defaultValue={data.fields.releaseTitle}
                required
                maxLength={200}
              />
            </label>
            <label>
              Release description
              <textarea
                name="summary"
                readOnly={!data.editable || data.releaseFieldsEditable === false}
                defaultValue={data.fields.summary}
                maxLength={5000}
                rows={4}
              />
            </label>
            {data.releaseFieldsEditable === false ? (
              <p>
                Release title and description are shared with an existing album. Accept this track
                first, then edit these fields for the release.
              </p>
            ) : null}
            <MultiSelect
              name="genres"
              label="Genres"
              options={GENRES}
              defaultValue={data.fields.genres}
              disabled={busy || !discoveryEditable}
            />
            <MultiSelect
              name="moods"
              label="Moods"
              options={MOODS}
              defaultValue={data.fields.moods}
              disabled={busy || !discoveryEditable}
            />
            <MultiSelect
              name="processTags"
              label="Process tags"
              options={PROCESS_TAGS}
              defaultValue={data.fields.processTags}
              disabled={busy || !discoveryEditable}
            />
            <p>
              {data.editable
                ? "Publication still requires genres, moods and process tags. You can save incomplete details and return later."
                : "Choose at least one genre, mood and process tag before saving."}
            </p>
          </CuratorPanel>
          <CuratorPanel>
            <label>
              Reason for these changes
              <textarea name="reason" required minLength={3} maxLength={1000} rows={2} />
            </label>
            <CuratorButton type="submit" variant="primary" disabled={busy || !canSave}>
              {preparing ? "Preparing artwork…" : pending ? "Saving…" : "Save changes"}
            </CuratorButton>
          </CuratorPanel>
        </fieldset>
      </form>
      <nav className="publishing-back">
        <Link to={`/curator/submissions?review=${data.id}`}>← Back to submission</Link>
        {data.trackId ? (
          <>
            {" "}
            · <Link to={`/curator/albums?track=${data.trackId}`}>Return to publishing →</Link>
          </>
        ) : null}
      </nav>
    </>
  );
}
