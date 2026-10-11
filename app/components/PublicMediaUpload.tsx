import { useState } from "react";
import { useRevalidator } from "react-router";
import { computeBlobSha256 } from "~/utils/sha256";
import { normalizeMediaMime, readMediaMetadata } from "~/utils/media-file";

export function PublicMediaUpload({
  kind,
  targetId,
  label,
}: {
  kind: "audio" | "artwork";
  targetId: string;
  label: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const revalidator = useRevalidator();
  async function upload(selected: File) {
    if (state !== "idle") return;
    setMessage("");
    setState("Reading file…");
    try {
      if (selected.size > (kind === "audio" ? 500 : 20) * 1024 * 1024)
        throw new Error("File exceeds upload limit.");
      const mimeType = normalizeMediaMime(selected);
      const [checksumSha256, metadata] = await Promise.all([
        computeBlobSha256(selected),
        readMediaMetadata(selected, kind),
      ]);
      async function response(response: Response) {
        const value = (await response.json()) as { error?: string; id?: string };
        if (!response.ok) throw new Error(value.error ?? "Upload failed. Try again.");
        return value;
      }
      setState("Preparing upload…");
      const session = await response(
        await fetch("/curator/api/uploads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind,
            scope: "publishable_derivative",
            mimeType,
            byteSize: selected.size,
            checksumSha256,
            targetEntityType: kind === "audio" ? "track" : "release",
            targetEntityId: targetId,
            ...metadata,
          }),
        }),
      );
      if (!session.id) throw new Error("Upload session unavailable.");
      setState("Uploading…");
      const stored = await fetch(`/curator/api/uploads/${session.id}`, {
        method: "PUT",
        headers: { "content-type": mimeType },
        body: selected,
      });
      if (!stored.ok) throw new Error("Upload interrupted. Retry the selected file.");
      setState("Verifying…");
      await response(await fetch(`/curator/api/uploads/${session.id}`, { method: "PATCH" }));
      setMessage("Public listening asset ready.");
      setFile(null);
      await revalidator.revalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed. Retry.");
    } finally {
      setState("idle");
    }
  }
  return (
    <section>
      <label>
        {label}
        <input
          type="file"
          accept={
            kind === "audio"
              ? ".mp3,.m4a,.wav,.flac,.ogg,.webm"
              : "image/png,image/jpeg,image/webp,image/avif"
          }
          disabled={state !== "idle"}
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0];
            if (selected) {
              setFile(selected);
              void upload(selected);
            }
          }}
        />
      </label>
      <p role="status">{state !== "idle" ? state : message}</p>
      {file && state === "idle" && message ? (
        <button type="button" onClick={() => void upload(file)}>
          Retry upload
        </button>
      ) : null}
    </section>
  );
}
