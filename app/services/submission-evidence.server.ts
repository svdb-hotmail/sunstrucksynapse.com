import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { WorkerEnv } from "~/config/env.server";
import { evidenceUploadSessions } from "~/db/schema";
import * as schema from "~/db/schema";
import type { CuratorIdentity } from "~/types/curator";
import { IncrementalSha256 } from "~/utils/sha256";

import type {
  EvidenceUploadDeclaration,
  SubmissionRepository,
} from "~/repositories/submissions.server";
import { sha256Hex } from "./submission-security.server";

export type EvidenceResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 409 | 413; message: string };

export const EVIDENCE_MAX_BYTE_SIZE = 20 * 1024 * 1024;

const EVIDENCE_ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
]);

export function normalizeEvidenceMimeType(mimeType: string): string {
  return mimeType.trim().toLowerCase();
}

export function isSupportedEvidenceMimeType(mimeType: string): boolean {
  return EVIDENCE_ALLOWED_MIME_TYPES.has(normalizeEvidenceMimeType(mimeType));
}

function createFixedLengthStream(expectedSize: number): {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
} {
  const globalClass = Reflect.get(globalThis, "FixedLengthStream");
  if (typeof globalClass === "function") {
    return new globalClass(expectedSize);
  }
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  return { readable: stream.readable, writable: stream.writable };
}

export function parseEvidenceDeclaration(
  input: unknown,
): EvidenceResult<EvidenceUploadDeclaration> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, status: 400, message: "Invalid evidence declaration." };
  }
  const filename = Reflect.get(input, "filename");
  const mimeType = Reflect.get(input, "mimeType");
  const checksumSha256 = Reflect.get(input, "checksumSha256");
  const byteSize = Reflect.get(input, "byteSize");
  if (
    typeof filename !== "string" ||
    typeof mimeType !== "string" ||
    typeof checksumSha256 !== "string" ||
    typeof byteSize !== "number"
  ) {
    return { ok: false, status: 400, message: "Invalid evidence declaration." };
  }
  const normalizedFilename = filename.trim();
  const normalizedMimeType = normalizeEvidenceMimeType(mimeType);
  if (!normalizedFilename || !/^[0-9a-f]{64}$/.test(checksumSha256)) {
    return {
      ok: false,
      status: 400,
      message: "Evidence filename, MIME type, and checksum are required.",
    };
  }
  if (!isSupportedEvidenceMimeType(normalizedMimeType)) {
    return { ok: false, status: 400, message: "Unsupported evidence MIME type." };
  }
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    return { ok: false, status: 400, message: "Evidence byte size must be positive." };
  }
  if (byteSize > EVIDENCE_MAX_BYTE_SIZE) {
    return {
      ok: false,
      status: 413,
      message: "Evidence exceeds the 20 MiB limit.",
    };
  }
  return {
    ok: true,
    value: {
      filename: normalizedFilename,
      mimeType: normalizedMimeType,
      checksumSha256,
      byteSize,
    },
  };
}

export class SubmissionEvidenceService<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> {
  constructor(
    private readonly db: PgDatabase<TQueryResult, typeof schema>,
    private readonly repository: SubmissionRepository,
    private readonly env: WorkerEnv,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  createSession(tokenHash: string, declaration: EvidenceUploadDeclaration) {
    return this.repository.createEvidenceUploadSession(tokenHash, declaration, this.clock());
  }

  async upload(sessionId: string, request: Request): Promise<EvidenceResult<null>> {
    const [session] = await this.db
      .select()
      .from(evidenceUploadSessions)
      .where(eq(evidenceUploadSessions.id, sessionId))
      .limit(1);
    if (!session) return { ok: false, status: 404, message: "Evidence upload session not found." };
    if (session.status !== "pending" || session.expiresAt <= this.clock()) {
      return { ok: false, status: 409, message: "Evidence upload session is no longer active." };
    }
    if (!isSupportedEvidenceMimeType(session.mimeType)) {
      return { ok: false, status: 400, message: "Unsupported evidence MIME type." };
    }
    if (session.byteSize > EVIDENCE_MAX_BYTE_SIZE) {
      return { ok: false, status: 413, message: "Evidence exceeds the 20 MiB limit." };
    }
    if (
      normalizeEvidenceMimeType(request.headers.get("content-type")?.split(";")[0] ?? "") !==
      session.mimeType
    ) {
      return { ok: false, status: 400, message: "Content type does not match the declaration." };
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > session.byteSize) {
      return { ok: false, status: 413, message: "Evidence exceeds the declared byte size." };
    }
    if (!request.body) {
      return { ok: false, status: 400, message: "Upload body is required." };
    }

    const { readable, writable } = createFixedLengthStream(session.byteSize);
    const hasher = new IncrementalSha256();
    let streamed = 0;
    let byteSizeExceeded = false;
    const pump = (async () => {
      const reader = request.body!.getReader();
      const writer = writable.getWriter();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            streamed += value.byteLength;
            if (streamed > session.byteSize) {
              byteSizeExceeded = true;
              throw new Error("Evidence exceeds the declared byte size.");
            }
            hasher.update(value);
            await writer.write(value);
          }
        }
        await writer.close();
      } catch (error) {
        const pumpError = error instanceof Error ? error : new Error(String(error));
        await writer.abort(pumpError);
      } finally {
        reader.releaseLock();
      }
    })();

    const put = this.env.MEDIA_BUCKET.put(session.objectKey, readable, {
      httpMetadata: { contentType: session.mimeType },
      customMetadata: {
        checksumSha256: session.checksumSha256,
        uploadSessionId: session.id,
      },
      sha256: session.checksumSha256,
    });

    const [putResult, pumpResult] = await Promise.allSettled([put, pump]);
    if (byteSizeExceeded || streamed > session.byteSize) {
      await this.env.MEDIA_BUCKET.delete(session.objectKey);
      await this.repository.failEvidenceUploadSession(
        sessionId,
        this.clock(),
        "Byte size mismatch",
      );
      return { ok: false, status: 413, message: "Evidence exceeds the declared byte size." };
    }
    if (pumpResult.status === "rejected") {
      await this.env.MEDIA_BUCKET.delete(session.objectKey);
      await this.repository.failEvidenceUploadSession(sessionId, this.clock(), "Streaming failed");
      return { ok: false, status: 400, message: "Evidence upload failed." };
    }
    if (putResult.status === "rejected") {
      await this.repository.failEvidenceUploadSession(sessionId, this.clock(), "Upload failed");
      throw putResult.reason;
    }
    const stored = putResult.value;
    if (stored.size > session.byteSize) {
      await this.env.MEDIA_BUCKET.delete(session.objectKey);
      await this.repository.failEvidenceUploadSession(
        sessionId,
        this.clock(),
        "Byte size mismatch",
      );
      return { ok: false, status: 413, message: "Evidence exceeds the declared byte size." };
    }
    if (hasher.digestHex() !== session.checksumSha256) {
      await this.env.MEDIA_BUCKET.delete(session.objectKey);
      await this.repository.failEvidenceUploadSession(sessionId, this.clock(), "Checksum mismatch");
      return { ok: false, status: 400, message: "Checksum does not match the declaration." };
    }
    if (streamed !== session.byteSize || stored.size !== session.byteSize) {
      await this.env.MEDIA_BUCKET.delete(session.objectKey);
      await this.repository.failEvidenceUploadSession(
        sessionId,
        this.clock(),
        "Byte size mismatch",
      );
      return { ok: false, status: 400, message: "Byte size does not match the declaration." };
    }
    return { ok: true, value: null };
  }

  async complete(sessionId: string): Promise<EvidenceResult<{ evidenceId: string }>> {
    const [session] = await this.db
      .select()
      .from(evidenceUploadSessions)
      .where(eq(evidenceUploadSessions.id, sessionId))
      .limit(1);
    if (!session) return { ok: false, status: 404, message: "Evidence upload session not found." };
    if (session.status !== "pending") {
      return {
        ok: false,
        status: 409,
        message: "Evidence upload session has already been finalized.",
      };
    }
    if (session.expiresAt <= this.clock()) {
      return { ok: false, status: 409, message: "Evidence upload session has expired." };
    }
    const object = await this.env.MEDIA_BUCKET.head(session.objectKey);
    if (
      !object ||
      object.size !== session.byteSize ||
      object.customMetadata?.checksumSha256 !== session.checksumSha256
    ) {
      return { ok: false, status: 409, message: "Uploaded evidence object is incomplete." };
    }
    const evidence = await this.repository.completeEvidenceUploadSession(sessionId, this.clock());
    if (!evidence) {
      return { ok: false, status: 409, message: "Evidence upload session changed." };
    }
    return { ok: true, value: { evidenceId: evidence.id } };
  }

  cleanupAbandoned() {
    return this.repository.cleanupExpiredEvidenceUploadSessions(this.clock());
  }

  async createCuratorAccessGrant(
    evidenceId: string,
    actor: CuratorIdentity,
  ): Promise<EvidenceResult<{ token: string; expiresAt: string }>> {
    const token = crypto.randomUUID();
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const grant = await this.repository.createEvidenceAccessGrant(
      evidenceId,
      actor,
      now,
      expiresAt,
      sha256Hex(token),
    );
    return grant
      ? { ok: true, value: { token, expiresAt: expiresAt.toISOString() } }
      : { ok: false, status: 404, message: "Evidence item unavailable." };
  }

  async openGrantedEvidence(token: string): Promise<EvidenceResult<Response>> {
    const grant = await this.repository.consumeEvidenceAccessGrant(sha256Hex(token), this.clock());
    if (!grant) {
      return { ok: false, status: 404, message: "Evidence access link is invalid or expired." };
    }
    const object = await this.env.MEDIA_BUCKET.get(grant.objectKey, { range: new Headers() });
    if (!object) {
      return { ok: false, status: 404, message: "Evidence object is unavailable." };
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-disposition", `attachment; filename="${grant.originalFilename}"`);
    headers.set("cache-control", "private, max-age=0, no-store");
    headers.set("content-type", grant.mimeType);
    return {
      ok: true,
      value: new Response(object.body, {
        status: 200,
        headers,
      }),
    };
  }
}
