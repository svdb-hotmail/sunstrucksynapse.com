import { AwsClient } from "aws4fetch";

import type { WorkerEnv } from "~/config/env.server";
import {
  REVIEW_AUDIO_FINALIZE_LEASE_RENEWAL_MS,
  REVIEW_AUDIO_MAX_BYTES,
  REVIEW_AUDIO_MIME_TYPES,
  type CurationWorkflowRepository,
  type ReviewAudioDeclaration,
  type ReviewAudioRecord,
} from "~/repositories/curation-workflow.server";

export type ReviewAudioResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 409 | 413 | 503; message: string };

export type ReviewAudioRepository = Pick<
  CurationWorkflowRepository,
  | "createAudioUploadSession"
  | "claimAudioFinalization"
  | "renewAudioFinalizationLease"
  | "releaseAudioFinalization"
  | "completeAudioFinalization"
>;

export type ReviewAudioEnv = Pick<
  WorkerEnv,
  "MEDIA_BUCKET" | "R2_ACCOUNT_ID" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET_NAME"
>;

const REVIEW_AUDIO_MIME_ALIASES = new Map([
  ["audio/x-wav", "audio/wav"],
  ["audio/wave", "audio/wav"],
  ["audio/vnd.wave", "audio/wav"],
  ["audio/x-flac", "audio/flac"],
  ["audio/m4a", "audio/mp4"],
  ["audio/x-m4a", "audio/mp4"],
  ["application/ogg", "audio/ogg"],
]);

function normalizedMime(value: string): string {
  const mimeType = value.trim().toLowerCase().split(";", 1)[0] ?? "";
  return REVIEW_AUDIO_MIME_ALIASES.get(mimeType) ?? mimeType;
}

export function parseReviewAudioDeclaration(
  value: unknown,
): ReviewAudioResult<ReviewAudioDeclaration> {
  if (typeof value !== "object" || value === null) {
    return { ok: false, status: 400, message: "Invalid audio declaration." };
  }
  const filename = Reflect.get(value, "filename");
  const mimeType = Reflect.get(value, "mimeType");
  const checksumSha256 = Reflect.get(value, "checksumSha256");
  const byteSize = Reflect.get(value, "byteSize");
  const durationMs = Reflect.get(value, "durationMs");
  const codec = Reflect.get(value, "codec");
  if (
    typeof filename !== "string" ||
    typeof mimeType !== "string" ||
    typeof checksumSha256 !== "string" ||
    typeof byteSize !== "number" ||
    typeof durationMs !== "number" ||
    typeof codec !== "string"
  ) {
    return { ok: false, status: 400, message: "Invalid audio declaration." };
  }
  const declaration = {
    filename: filename.trim(),
    mimeType: normalizedMime(mimeType),
    checksumSha256: checksumSha256.trim().toLowerCase(),
    byteSize,
    durationMs: Math.round(durationMs),
    codec: codec.trim().toLowerCase(),
  };
  if (
    !declaration.filename ||
    !declaration.codec ||
    !/^[0-9a-f]{64}$/.test(declaration.checksumSha256)
  ) {
    return { ok: false, status: 400, message: "Audio metadata and checksum are required." };
  }
  if (!REVIEW_AUDIO_MIME_TYPES.has(declaration.mimeType)) {
    return { ok: false, status: 400, message: "Use MP3, M4A, WAV, Ogg, WebM, or FLAC audio." };
  }
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    return { ok: false, status: 400, message: "Audio byte size must be positive." };
  }
  if (byteSize > REVIEW_AUDIO_MAX_BYTES) {
    return { ok: false, status: 413, message: "Audio exceeds the 500 MiB limit." };
  }
  if (
    !Number.isSafeInteger(declaration.durationMs) ||
    declaration.durationMs < 1 ||
    declaration.durationMs > 86_400_000
  ) {
    return { ok: false, status: 400, message: "Audio duration is invalid." };
  }
  return { ok: true, value: declaration };
}

function createFixedLengthStream(expectedSize: number): {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
} {
  const fixedLengthStream = Reflect.get(globalThis, "FixedLengthStream");
  if (typeof fixedLengthStream === "function") return new fixedLengthStream(expectedSize);
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  return { readable: stream.readable, writable: stream.writable };
}

function s3Configuration(env: ReviewAudioEnv) {
  const values = [
    env.R2_ACCOUNT_ID,
    env.R2_ACCESS_KEY_ID,
    env.R2_SECRET_ACCESS_KEY,
    env.R2_BUCKET_NAME,
  ];
  if (values.some(Boolean) && !values.every(Boolean)) {
    throw new Error("Review-audio R2 S3 configuration is incomplete.");
  }
  if (!values.every(Boolean)) return null;
  return {
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucketName: env.R2_BUCKET_NAME!,
  };
}

export class ReviewAudioService {
  constructor(
    private readonly repository: ReviewAudioRepository,
    private readonly env: ReviewAudioEnv,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createUpload(
    tokenHash: string,
    declaration: ReviewAudioDeclaration,
  ): Promise<
    ReviewAudioResult<{
      sessionId: string;
      uploadUrl: string;
      uploadHeaders: Record<string, string>;
      expiresAt: string;
    }>
  > {
    let s3;
    try {
      s3 = s3Configuration(this.env);
    } catch {
      return { ok: false, status: 503, message: "Review-audio upload is not configured." };
    }
    if (!s3) {
      return { ok: false, status: 503, message: "Review-audio upload is not configured." };
    }
    const session = await this.repository.createAudioUploadSession(
      tokenHash,
      declaration,
      this.clock(),
    );
    if (!session) {
      return { ok: false, status: 409, message: "Save a draft before uploading review audio." };
    }
    const headers = {
      "content-type": session.mimeType,
      "x-amz-meta-checksum-sha256": session.checksumSha256,
      "x-amz-meta-upload-session-id": session.id,
    };
    const objectUrl = new URL(
      `https://${s3.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(s3.bucketName)}/${session.stagingObjectKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
    );
    objectUrl.searchParams.set("X-Amz-Expires", "900");
    const signer = new AwsClient({
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
      service: "s3",
      region: "auto",
    });
    const signed = await signer.sign(objectUrl, {
      method: "PUT",
      headers,
      aws: { signQuery: true, allHeaders: true },
    });
    return {
      ok: true,
      value: {
        sessionId: session.id,
        uploadUrl: signed.url,
        uploadHeaders: headers,
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  }

  async finalize(
    tokenHash: string,
    sessionId: string,
  ): Promise<ReviewAudioResult<ReviewAudioRecord>> {
    const now = this.clock();
    const session = await this.repository.claimAudioFinalization(sessionId, tokenHash, now);
    if (!session || !session.leaseToken) {
      return { ok: false, status: 409, message: "Audio upload cannot be finalized." };
    }
    const fail = async (message: string, code: string): Promise<ReviewAudioResult<never>> => {
      await this.repository.releaseAudioFinalization(
        session.id,
        session.leaseToken!,
        code,
        this.clock(),
      );
      return { ok: false, status: 409, message };
    };
    let head;
    try {
      head = await this.env.MEDIA_BUCKET.head(session.stagingObjectKey);
    } catch {
      return fail("Uploaded audio is temporarily unavailable.", "R2_HEAD_FAILED");
    }
    if (!head || head.size !== session.byteSize) {
      return fail("Uploaded audio is incomplete.", "OBJECT_INCOMPLETE");
    }
    let source;
    try {
      source = await this.env.MEDIA_BUCKET.get(session.stagingObjectKey, {
        range: new Headers(),
      });
    } catch {
      return fail("Uploaded audio is temporarily unavailable.", "R2_GET_FAILED");
    }
    if (!source) return fail("Uploaded audio is unavailable.", "OBJECT_MISSING");

    const fencedFinalObjectKey = `private/review-audio/final/${session.submissionId}/${session.id}-${session.leaseToken}-${session.checksumSha256.slice(0, 16)}`;
    const cleanupFencedFinal = async () => {
      try {
        await this.env.MEDIA_BUCKET.delete(fencedFinalObjectKey);
      } catch {
        // The lease-token fence prevents this failed attempt from becoming current.
      }
    };
    let leaseRenewedAt = now.getTime();
    const renewLease = async (force = false) => {
      const renewedAt = this.clock();
      if (!force && renewedAt.getTime() - leaseRenewedAt < REVIEW_AUDIO_FINALIZE_LEASE_RENEWAL_MS) {
        return true;
      }
      const renewed = await this.repository.renewAudioFinalizationLease(
        session.id,
        session.leaseToken!,
        renewedAt,
      );
      if (renewed) leaseRenewedAt = renewedAt.getTime();
      return renewed;
    };
    const { readable, writable } = createFixedLengthStream(session.byteSize);
    let streamed = 0;
    const pump = (async () => {
      const reader = source.body.getReader();
      const writer = writable.getWriter();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            if (!(await renewLease())) throw new Error("finalization lease lost");
            streamed += value.byteLength;
            if (streamed > session.byteSize) throw new Error("oversized");
            await writer.write(value);
          }
        }
        await writer.close();
      } catch (error) {
        await writer.abort(error);
        throw error;
      } finally {
        reader.releaseLock();
      }
    })();
    const put = this.env.MEDIA_BUCKET.put(fencedFinalObjectKey, readable, {
      httpMetadata: { contentType: session.mimeType },
      customMetadata: {
        checksumSha256: session.checksumSha256,
        uploadSessionId: session.id,
        submissionId: session.submissionId,
      },
      sha256: session.checksumSha256,
    });
    const [putResult, pumpResult] = await Promise.allSettled([put, pump]);
    if (
      putResult.status === "rejected" ||
      pumpResult.status === "rejected" ||
      streamed !== session.byteSize
    ) {
      await cleanupFencedFinal();
      return fail("Audio verification failed. Upload the file again.", "VERIFICATION_FAILED");
    }
    let sealed;
    try {
      sealed = await this.env.MEDIA_BUCKET.head(fencedFinalObjectKey);
    } catch {
      await cleanupFencedFinal();
      return fail("Audio sealing failed. Upload the file again.", "SEALING_FAILED");
    }
    if (!sealed || sealed.size !== session.byteSize) {
      await cleanupFencedFinal();
      return fail("Audio sealing failed. Upload the file again.", "SEALING_FAILED");
    }
    if (!(await renewLease(true))) {
      await cleanupFencedFinal();
      return fail("Audio finalization lease was lost. Upload the file again.", "LEASE_LOST");
    }
    const audio = await this.repository.completeAudioFinalization(
      session.id,
      session.leaseToken,
      fencedFinalObjectKey,
      this.clock(),
    );
    if (!audio) {
      await cleanupFencedFinal();
      return fail("Audio finalization conflicted. Upload the file again.", "FINALIZE_CONFLICT");
    }
    try {
      await this.env.MEDIA_BUCKET.delete(session.stagingObjectKey);
    } catch {
      // The upload-session outbox job and R2 lifecycle rule retry staging cleanup.
    }
    return { ok: true, value: audio };
  }
}
