import { useState } from "react";
import { useRevalidator } from "react-router";
import { normalizeMediaMime, readMediaMetadata } from "~/utils/media-file";

import { computeBlobSha256 } from "~/utils/sha256";
import { readUploadResponse, sendUploadRequest } from "~/utils/upload-response";

export interface ReviewAudioUploaderProps {
  endpoint: string;
  currentAudio?: { filename: string; version: number } | null;
  disabled?: boolean;
  disabledMessage?: string;
  showHeading?: boolean;
}

export function ReviewAudioUploader({
  endpoint,
  currentAudio = null,
  disabled = false,
  disabledMessage = "Save the submission draft before uploading audio.",
  showHeading = true,
}: ReviewAudioUploaderProps) {
  const revalidator = useRevalidator();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "preparing" | "uploading" | "finalizing" | "done">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function upload(selectedFile = file) {
    if (!selectedFile || disabled || state !== "idle") return;
    setMessage(null);
    try {
      setState("preparing");
      if (selectedFile.size > 500 * 1024 * 1024)
        throw new Error("Private listening files must be 500 MiB or smaller.");
      const mimeType = normalizeMediaMime(selectedFile);
      const [checksumSha256, metadata] = await Promise.all([
        computeBlobSha256(selectedFile),
        readMediaMetadata(selectedFile, "audio"),
      ]);
      const declarationResponse = await sendUploadRequest(
        endpoint,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: selectedFile.name,
            mimeType,
            checksumSha256,
            byteSize: selectedFile.size,
            durationMs: metadata.durationMs,
            codec: mimeType.split("/")[1] || "unknown",
          }),
        },
        "The connection was interrupted before the upload started. Try upload again.",
      );
      const declaration = await readUploadResponse<{
        error?: string;
        sessionId?: string;
        uploadUrl?: string;
        uploadHeaders?: Record<string, string>;
      }>(declarationResponse, "The server could not start the audio upload. Try upload again.");
      if (!declarationResponse.ok || !declaration.sessionId || !declaration.uploadUrl) {
        throw new Error(declaration.error || "Could not start the audio upload.");
      }
      setState("uploading");
      const uploadResponse = await sendUploadRequest(
        declaration.uploadUrl,
        {
          method: "PUT",
          headers: declaration.uploadHeaders,
          body: selectedFile,
        },
        "The connection was interrupted while sending the audio. Try upload again.",
      );
      if (!uploadResponse.ok) throw new Error("The private audio upload failed.");
      setState("finalizing");
      const finalResponse = await sendUploadRequest(
        `${endpoint}/${declaration.sessionId}`,
        { method: "POST" },
        "The connection was interrupted while finishing the audio upload. Try upload again.",
      );
      await readUploadResponse(
        finalResponse,
        "The server could not finish verifying the audio. Try upload again. Your submission draft is saved.",
      );
      setState("done");
      setFile(null);
      setMessage("Review audio is ready.");
      await revalidator.revalidate();
      setState("idle");
    } catch (error) {
      setState("idle");
      setMessage(error instanceof Error ? error.message : "Audio upload failed.");
    }
  }

  return (
    <section
      className="review-audio-uploader"
      aria-label={showHeading ? undefined : "Music for curator review"}
      aria-labelledby={showHeading ? "review-audio-heading" : undefined}
    >
      {showHeading ? (
        <>
          <p className="eyebrow">Private listening copy</p>
          <h2 id="review-audio-heading">Music for curator review</h2>
        </>
      ) : null}
      <p>
        Upload one finished track. It is stored privately and never becomes the public listening
        file. Uploading a replacement creates a new retained version.
      </p>
      {currentAudio ? (
        <p role="status">
          Ready: <strong>{currentAudio.filename}</strong> · version {currentAudio.version}
        </p>
      ) : (
        <p>No review audio uploaded yet.</p>
      )}
      <label>
        Audio file
        <input
          type="file"
          accept=".mp3,.m4a,.wav,.ogg,.oga,.webm,.flac,audio/*"
          disabled={disabled || state !== "idle"}
          onChange={(event) => {
            const selectedFile = event.currentTarget.files?.[0] ?? null;
            setFile(selectedFile);
            if (selectedFile) void upload(selectedFile);
          }}
        />
      </label>
      {file && state === "idle" && message ? (
        <button type="button" disabled={disabled} onClick={() => void upload()}>
          Try upload again
        </button>
      ) : null}
      {state !== "idle" ? (
        <p role="status" aria-live="polite">
          {state === "preparing"
            ? "Preparing audio…"
            : state === "uploading"
              ? "Uploading audio…"
              : state === "finalizing"
                ? "Finishing upload…"
                : "Review audio is ready. Updating submission…"}
        </p>
      ) : null}
      {disabled ? <p>{disabledMessage}</p> : null}
      {message ? <p role={file && state === "idle" ? "alert" : "status"}>{message}</p> : null}
    </section>
  );
}
