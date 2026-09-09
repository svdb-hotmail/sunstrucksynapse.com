import { useState } from "react";

import { computeBlobSha256 } from "~/utils/sha256";

export interface ReviewAudioUploaderProps {
  endpoint: string;
  currentAudio?: { filename: string; version: number } | null;
  disabled?: boolean;
  disabledMessage?: string;
  showHeading?: boolean;
}

function audioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(audio.duration * 1000));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The browser could not read the audio duration."));
    };
    audio.src = url;
  });
}

export function ReviewAudioUploader({
  endpoint,
  currentAudio = null,
  disabled = false,
  disabledMessage = "Save the submission draft before uploading audio.",
  showHeading = true,
}: ReviewAudioUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "preparing" | "uploading" | "finalizing" | "done">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function upload() {
    if (!file || disabled || state !== "idle") return;
    setMessage(null);
    try {
      setState("preparing");
      const [checksumSha256, durationMs] = await Promise.all([
        computeBlobSha256(file),
        audioDuration(file),
      ]);
      const declarationResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          checksumSha256,
          byteSize: file.size,
          durationMs,
          codec: file.type.split("/")[1] || "unknown",
        }),
      });
      const declaration = (await declarationResponse.json()) as {
        error?: string;
        sessionId?: string;
        uploadUrl?: string;
        uploadHeaders?: Record<string, string>;
      };
      if (!declarationResponse.ok || !declaration.sessionId || !declaration.uploadUrl) {
        throw new Error(declaration.error || "Could not start the audio upload.");
      }
      setState("uploading");
      const uploadResponse = await fetch(declaration.uploadUrl, {
        method: "PUT",
        headers: declaration.uploadHeaders,
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("The private audio upload failed.");
      setState("finalizing");
      const finalResponse = await fetch(`${endpoint}/${declaration.sessionId}`, { method: "POST" });
      const final = (await finalResponse.json()) as { error?: string };
      if (!finalResponse.ok) throw new Error(final.error || "Could not finalize the audio upload.");
      setState("done");
      setMessage("Review audio is ready. Reloading…");
      window.location.reload();
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
          accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,audio/flac"
          disabled={disabled || state !== "idle"}
          onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
        />
      </label>
      <button type="button" disabled={!file || disabled || state !== "idle"} onClick={upload}>
        {state === "idle"
          ? currentAudio
            ? "Replace review audio"
            : "Upload review audio"
          : `${state}…`}
      </button>
      {disabled ? <p>{disabledMessage}</p> : null}
      {message ? <p role={state === "idle" ? "alert" : "status"}>{message}</p> : null}
    </section>
  );
}
