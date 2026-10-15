import { AwsClient } from "aws4fetch";
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
    const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = this.env;
    if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)
      throw new Error("Cover storage is unavailable.");
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
    const client = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    });
    const url = new URL(
      `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${stagingObjectKey}`,
    );
    url.searchParams.set("X-Amz-Expires", "900");
    const headers = {
      "content-type": declaration.mimeType,
      "x-amz-meta-checksum-sha256": declaration.checksumSha256,
      "x-amz-meta-upload-session-id": id,
    };
    const signed = await client.sign(new Request(url, { method: "PUT", headers }), {
      aws: { signQuery: true },
    });
    return { sessionId: id, uploadUrl: signed.url, uploadHeaders: headers };
  }
  async finalize(tokenHash: string, id: string) {
    const lease = crypto.randomUUID();
    const cover = await this.repository.claimCover(tokenHash, id, lease);
    if (!cover)
      throw new Error("Cover changed, expired, or is already verifying. Reload and retry.");
    const key = `private/submission-covers/final/${id}/${lease}`;
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
      });
      if (!source || source.size !== cover.byteSize)
        throw new Error("The cover upload is incomplete.");
      // Native R2 checksum validation avoids hashing large image bodies in JS.
      await this.env.MEDIA_BUCKET.put(key, source.body, {
        httpMetadata: { contentType: cover.mimeType },
        customMetadata: { checksumSha256: cover.checksumSha256, submissionId: cover.submissionId },
        sha256: cover.checksumSha256,
      });
      if (
        (await this.env.MEDIA_BUCKET.head(key))?.size !== cover.byteSize ||
        !(await this.repository.completeCover(tokenHash, id, lease, key))
      )
        throw new Error("The submission changed before the cover was saved.");
      await this.env.MEDIA_BUCKET.delete(cover.stagingObjectKey).catch(() => {});
      return { coverId: id };
    } catch (error) {
      await this.env.MEDIA_BUCKET.delete(key).catch(() => {});
      await this.repository.releaseCover(id, lease);
      throw error;
    }
  }
}
