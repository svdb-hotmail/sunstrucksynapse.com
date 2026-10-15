import { imageSize } from "image-size";
import { COVER_MAX_BYTES, COVER_MIN_PIXELS, COVER_MIME_TYPES } from "~/config/music-metadata";
import type { WorkerEnv } from "~/config/env.server";
import { createReleaseIntakeRepository } from "~/repositories/release-intake.server";
import type { Database } from "~/db/client.server";

interface CoverDeclaration {
  filename: string;
  mimeType: string;
  checksumSha256: string;
  byteSize: number;
  width: number;
  height: number;
  rightsConfirmed: true;
}
export function validateCover(value: unknown): CoverDeclaration {
  if (!value || typeof value !== "object") throw new Error("Choose a cover image.");
  const v = value as CoverDeclaration;
  if (v.rightsConfirmed !== true) throw new Error("Confirm permission to publish this cover.");
  if (
    typeof v.filename !== "string" ||
    !v.filename.trim() ||
    v.filename.length > 255 ||
    !COVER_MIME_TYPES.includes(v.mimeType as (typeof COVER_MIME_TYPES)[number]) ||
    !/^[0-9a-f]{64}$/.test(v.checksumSha256)
  )
    throw new Error("Use a JPG, PNG, WebP or AVIF cover.");
  if (!Number.isSafeInteger(v.byteSize) || v.byteSize < 1 || v.byteSize > COVER_MAX_BYTES)
    throw new Error("The cover must be no larger than 20 MiB.");
  if (
    !Number.isSafeInteger(v.width) ||
    v.width !== v.height ||
    v.width < COVER_MIN_PIXELS ||
    v.width > 10000
  )
    throw new Error(
      "Use a square cover between 1400 × 1400 and 10000 × 10000 pixels. 3000 × 3000 is recommended.",
    );
  return v;
}
export class SubmissionCoverService {
  private repository;
  constructor(
    db: Database,
    private env: WorkerEnv,
  ) {
    this.repository = createReleaseIntakeRepository(db);
  }
  async create(tokenHash: string, declaration: CoverDeclaration) {
    const id = crypto.randomUUID();
    const stagingObjectKey = `private/submission-covers/staging/${id}`;
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const saved = await this.repository.createCover(tokenHash, {
      ...declaration,
      id,
      stagingObjectKey,
      expiresAt,
    });
    if (!saved)
      throw new Error(
        "Save an editable draft first. An album with a shared cover keeps that cover; reload your invitation to reuse it.",
      );
    return { sessionId: id, uploadHeaders: { "content-type": declaration.mimeType } };
  }
  async upload(tokenHash: string, id: string, request: Request) {
    const lease = crypto.randomUUID();
    const cover = await this.repository.claimCover(tokenHash, id, lease);
    if (!cover) throw new Error("Cover changed or expired. Reload and retry.");
    try {
      if (
        request.headers.get("content-length") !== String(cover.byteSize) ||
        request.headers.get("content-type") !== cover.mimeType ||
        cover.byteSize > COVER_MAX_BYTES ||
        !request.body
      )
        throw new Error(
          "The uploaded cover must match its declared format and size, up to 20 MiB.",
        );
      // Covers pass through the authorized app route. FixedLengthStream rejects
      // oversized/chunked bodies before R2 can commit an object.
      const fixed = new FixedLengthStream(cover.byteSize);
      const transfer = new AbortController();
      const timer = setTimeout(() => transfer.abort(new Error("Cover upload timeout")), 60000);
      try {
        await Promise.all([
          request.body.pipeTo(fixed.writable, { signal: transfer.signal }),
          this.env.MEDIA_BUCKET.put(cover.stagingObjectKey, fixed.readable, {
            httpMetadata: { contentType: cover.mimeType },
            customMetadata: { checksumSha256: cover.checksumSha256, uploadSessionId: id },
            sha256: cover.checksumSha256,
          }).catch((error) => {
            transfer.abort(error);
            throw error;
          }),
        ]);
      } finally {
        clearTimeout(timer);
        transfer.abort();
      }
      return { uploaded: true };
    } catch (error) {
      await this.env.MEDIA_BUCKET.delete(cover.stagingObjectKey).catch(() => {});
      throw error;
    } finally {
      await this.repository.releaseCover(id, lease);
    }
  }
  async finalize(tokenHash: string, id: string) {
    const lease = crypto.randomUUID();
    const cover = await this.repository.claimCover(tokenHash, id, lease);
    if (!cover)
      throw new Error("Cover changed, expired, or is already verifying. Reload and retry.");
    const key = `private/submission-covers/final/${id}/${lease}`;
    let completionUncertain = false;
    try {
      const header = await this.env.MEDIA_BUCKET.get(cover.stagingObjectKey, {
        range: new Headers({ Range: "bytes=0-1048575" }),
      });
      if (!header) throw new Error("Cover upload is incomplete. Choose the file again.");
      const dimensions = imageSize(new Uint8Array(await new Response(header.body).arrayBuffer()));
      const mime = dimensions.type === "jpg" ? "image/jpeg" : `image/${dimensions.type}`;
      if (
        dimensions.width !== cover.width ||
        dimensions.height !== cover.height ||
        mime !== cover.mimeType
      )
        throw new Error("The cover format or dimensions do not match the uploaded image.");
      const source = await this.env.MEDIA_BUCKET.get(cover.stagingObjectKey, {
        range: new Headers(),
        onlyIf: new Headers({ "if-match": header.httpEtag }),
      });
      if (
        !source ||
        !("body" in source) ||
        source.httpEtag !== header.httpEtag ||
        source.size !== cover.byteSize
      )
        throw new Error("The cover upload is incomplete.");
      // Native R2 checksum validation avoids hashing large image bodies in JS.
      await this.env.MEDIA_BUCKET.put(key, source.body, {
        httpMetadata: { contentType: cover.mimeType },
        customMetadata: { checksumSha256: cover.checksumSha256, submissionId: cover.submissionId },
        sha256: cover.checksumSha256,
      });
      if ((await this.env.MEDIA_BUCKET.head(key))?.size !== cover.byteSize)
        throw new Error("The cover upload is incomplete.");
      completionUncertain = true;
      const completed = await this.repository.completeCover(tokenHash, id, lease, key);
      completionUncertain = false;
      if (!completed) throw new Error("The submission changed before the cover was saved.");
      if (completed.id !== id) await this.env.MEDIA_BUCKET.delete(key).catch(() => {});
      await this.env.MEDIA_BUCKET.delete(cover.stagingObjectKey).catch(() => {});
      return { coverId: completed.id };
    } catch (error) {
      if (!completionUncertain) await this.env.MEDIA_BUCKET.delete(key).catch(() => {});
      await this.repository.releaseCover(id, lease);
      throw error;
    }
  }
}
