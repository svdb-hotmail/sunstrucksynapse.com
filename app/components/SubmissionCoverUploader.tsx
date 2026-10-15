import { useState } from "react";
import { useRevalidator } from "react-router";
import { COVER_MAX_BYTES, COVER_MIN_PIXELS, COVER_RIGHTS_STATEMENT } from "~/config/music-metadata";
import { normalizeMediaMime, readMediaMetadata } from "~/utils/media-file";
import { computeBlobSha256 } from "~/utils/sha256";
import { readUploadResponse, sendUploadRequest } from "~/utils/upload-response";

export function SubmissionCoverUploader({
  endpoint,
  disabled = false,
}: {
  endpoint: string;
  disabled?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const revalidator = useRevalidator();
  async function upload(selected: File) {
    if (pending || disabled) return;
    setPending(true);
    setMessage("Checking cover…");
    try {
      if (selected.size > COVER_MAX_BYTES)
        throw new Error("Cover images must be 20 MiB or smaller.");
      const metadata = await readMediaMetadata(selected, "artwork");
      if (
        !metadata.width ||
        metadata.width !== metadata.height ||
        metadata.width < COVER_MIN_PIXELS ||
        metadata.width > 10000
      )
        throw new Error("Choose a square image between 1400 and 10000 pixels on each side.");
      const mimeType = normalizeMediaMime(selected);
      const declaration = await readUploadResponse<{
        sessionId: string;
        uploadUrl: string;
        uploadHeaders: Record<string, string>;
      }>(
        await sendUploadRequest(
          endpoint,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              filename: selected.name,
              mimeType,
              byteSize: selected.size,
              checksumSha256: await computeBlobSha256(selected),
              rightsConfirmed: true,
              ...metadata,
            }),
          },
          "Could not start the cover upload. Retry.",
        ),
        "Could not start the cover upload. Retry.",
      );
      setMessage("Uploading cover…");
      const sent = await sendUploadRequest(
        declaration.uploadUrl,
        { method: "PUT", headers: declaration.uploadHeaders, body: selected },
        "Cover upload interrupted. Retry.",
      );
      if (!sent.ok) throw new Error("Cover upload interrupted. Retry.");
      setMessage("Verifying cover…");
      await readUploadResponse(
        await sendUploadRequest(
          `${endpoint}/${declaration.sessionId}`,
          { method: "POST" },
          "Could not finish the cover. Retry.",
        ),
        "Could not verify the cover. Retry.",
      );
      setFile(null);
      setMessage("Cover saved.");
      await revalidator.revalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the cover. Retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-label="Cover upload">
      <p>
        Square JPG, PNG, WebP or AVIF · 1400–10000 px per side · 3000 × 3000 recommended · up to 20
        MiB.
      </p>
      <p>{COVER_RIGHTS_STATEMENT}</p>
      <label>
        Choose cover
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={disabled || pending}
          onChange={(e) => {
            const selected = e.currentTarget.files?.[0];
            if (selected) {
              setFile(selected);
              void upload(selected);
            }
            e.currentTarget.value = "";
          }}
        />
      </label>
      <p role="status">{message}</p>
      {file && !pending ? (
        <button type="button" disabled={disabled} onClick={() => void upload(file)}>
          Retry cover upload
        </button>
      ) : null}
    </section>
  );
}
