import { imageSize } from "image-size";
import { COVER_MAX_BYTES, COVER_MIN_PIXELS, COVER_MIME_TYPES } from "~/config/music-metadata";
import type { WorkerEnv } from "~/config/env.server";
import type { EditorialArtwork } from "~/repositories/submission-edit.server";

export async function storeCuratorArtwork(file: File, env: WorkerEnv): Promise<EditorialArtwork> {
  if (!file.size || file.size > COVER_MAX_BYTES)
    throw new Error("Use a cover no larger than 20 MiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let dimensions;
  try {
    dimensions = imageSize(bytes);
  } catch {
    throw new Error("Use a valid JPG, PNG, WebP or AVIF image.");
  }
  const mimeType = dimensions.type === "jpg" ? "image/jpeg" : `image/${dimensions.type}`;
  if (!COVER_MIME_TYPES.includes(mimeType as (typeof COVER_MIME_TYPES)[number]))
    throw new Error("Use a JPG, PNG, WebP or AVIF cover.");
  if (
    dimensions.width !== dimensions.height ||
    dimensions.width < COVER_MIN_PIXELS ||
    dimensions.width > 10000
  )
    throw new Error("Use a square cover between 1400 and 10000 pixels.");
  const checksum = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const checksumSha256 = Array.from(checksum, (b) => b.toString(16).padStart(2, "0")).join("");
  if (!env.AUDIO_ENCODER)
    throw new Error("Artwork validation is unavailable. Please retry shortly.");
  const response = await env.AUDIO_ENCODER.fetch("https://encoder/validate-artwork", {
    method: "POST",
    body: new Blob([bytes]),
    headers: {
      "content-type": mimeType,
      "content-length": String(bytes.byteLength),
      "x-source-checksum": checksumSha256,
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(
      "The image could not be fully decoded. Use a complete, still JPG, PNG, WebP or AVIF cover, or retry if the encoder is busy.",
    );
  const verified = (await response.json()) as Record<string, unknown>;
  if (
    verified.checksumSha256 !== checksumSha256 ||
    verified.byteSize !== bytes.byteLength ||
    verified.width !== dimensions.width ||
    verified.height !== dimensions.height ||
    verified.mimeType !== mimeType
  )
    throw new Error("Artwork validation did not match the uploaded file. Retry the upload.");
  const id = crypto.randomUUID();
  const objectKey = `private/curator-artwork/${id}`;
  const stored = await env.MEDIA_BUCKET.put(objectKey, new Blob([bytes]).stream(), {
    httpMetadata: { contentType: mimeType },
    customMetadata: { checksumSha256 },
    sha256: checksumSha256,
  });
  if (stored.size !== bytes.byteLength)
    throw new Error("The cover could not be verified. Retry the upload.");
  return {
    id,
    objectKey,
    checksumSha256,
    mimeType,
    byteSize: bytes.byteLength,
    width: dimensions.width,
    height: dimensions.height,
    filename: file.name.slice(0, 255),
  };
}
