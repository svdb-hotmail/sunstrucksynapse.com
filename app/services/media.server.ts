import { and, eq, inArray, lt } from "drizzle-orm";

import type { CuratorIdentity } from "~/config/cloudflare-context.server";
import type { WorkerEnv } from "~/config/env.server";
import type { Database } from "~/db/client.server";
import { artworkAssets, audioAssets, uploadSessions } from "~/db/schema";

export type UploadKind = "artwork" | "audio";
export type AssetScope = "private_master" | "publishable_derivative";

export interface UploadDeclaration {
  kind: UploadKind;
  targetEntityId?: string;
  scope: AssetScope;
  mimeType: string;
  checksumSha256: string;
  byteSize: number;
  width?: number;
  height?: number;
  durationMs?: number;
  codec?: string;
}

export type MediaResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 409 | 413; message: string };

const limits = {
  artwork: 20 * 1024 * 1024,
  audio: 500 * 1024 * 1024,
} as const;
const allowedMimeTypes: Readonly<Record<UploadKind, ReadonlySet<string>>> = {
  artwork: new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  audio: new Set(["audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/flac", "audio/wav"]),
};

export function validateUploadDeclaration(
  input: UploadDeclaration,
): MediaResult<UploadDeclaration> {
  if (!allowedMimeTypes[input.kind].has(input.mimeType)) {
    return { ok: false, status: 400, message: `Unsupported ${input.kind} MIME type.` };
  }
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 1) {
    return { ok: false, status: 400, message: "A positive byte size is required." };
  }
  if (input.byteSize > limits[input.kind]) {
    return { ok: false, status: 413, message: `${input.kind} exceeds the upload limit.` };
  }
  if (!/^[0-9a-f]{64}$/.test(input.checksumSha256)) {
    return { ok: false, status: 400, message: "A lowercase SHA-256 checksum is required." };
  }
  if (
    input.kind === "artwork" &&
    (!Number.isSafeInteger(input.width) ||
      !Number.isSafeInteger(input.height) ||
      (input.width ?? 0) < 1 ||
      (input.height ?? 0) < 1)
  ) {
    return { ok: false, status: 400, message: "Artwork dimensions are required." };
  }
  if (
    input.kind === "audio" &&
    (!input.targetEntityId ||
      !Number.isSafeInteger(input.durationMs) ||
      (input.durationMs ?? 0) < 1 ||
      !input.codec?.trim())
  ) {
    return { ok: false, status: 400, message: "Audio requires a track, duration, and codec." };
  }
  return { ok: true, value: input };
}

export function parseUploadDeclaration(input: unknown): MediaResult<UploadDeclaration> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, status: 400, message: "Invalid upload declaration." };
  }
  const kind = Reflect.get(input, "kind");
  const scope = Reflect.get(input, "scope");
  const mimeType = Reflect.get(input, "mimeType");
  const checksumSha256 = Reflect.get(input, "checksumSha256");
  const byteSize = Reflect.get(input, "byteSize");
  if (
    (kind !== "artwork" && kind !== "audio") ||
    (scope !== "private_master" && scope !== "publishable_derivative") ||
    typeof mimeType !== "string" ||
    typeof checksumSha256 !== "string" ||
    typeof byteSize !== "number"
  ) {
    return { ok: false, status: 400, message: "Invalid upload declaration." };
  }
  const optionalString = (name: string): string | undefined => {
    const value = Reflect.get(input, name);
    return typeof value === "string" ? value : undefined;
  };
  const optionalNumber = (name: string): number | undefined => {
    const value = Reflect.get(input, name);
    return typeof value === "number" ? value : undefined;
  };
  return validateUploadDeclaration({
    kind,
    scope,
    mimeType,
    checksumSha256,
    byteSize,
    targetEntityId: optionalString("targetEntityId"),
    width: optionalNumber("width"),
    height: optionalNumber("height"),
    durationMs: optionalNumber("durationMs"),
    codec: optionalString("codec"),
  });
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export class MediaService {
  constructor(
    private readonly db: Database,
    private readonly env: WorkerEnv,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createSession(
    declaration: UploadDeclaration,
    actor: CuratorIdentity,
  ): Promise<MediaResult<{ id: string; expiresAt: string }>> {
    const validated = validateUploadDeclaration(declaration);
    if (!validated.ok) return validated;
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const prefix = declaration.scope === "private_master" ? "private" : "publishable";
    const objectKey = `${prefix}/${declaration.kind}/${crypto.randomUUID()}`;
    const [row] = await this.db
      .insert(uploadSessions)
      .values({
        assetKind: declaration.kind,
        targetEntityId: declaration.targetEntityId,
        objectKey,
        scope: declaration.scope,
        mimeType: declaration.mimeType,
        checksumSha256: declaration.checksumSha256,
        byteSize: declaration.byteSize,
        width: declaration.width,
        height: declaration.height,
        durationMs: declaration.durationMs,
        codec: declaration.codec?.trim(),
        actorEmail: actor.email,
        actorId: actor.id,
        expiresAt,
      })
      .returning({ id: uploadSessions.id });
    return { ok: true, value: { id: row.id, expiresAt: expiresAt.toISOString() } };
  }

  async upload(sessionId: string, request: Request): Promise<MediaResult<null>> {
    const [session] = await this.db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, sessionId))
      .limit(1);
    if (!session) return { ok: false, status: 404, message: "Upload session not found." };
    if (session.status !== "pending" || session.expiresAt <= this.clock()) {
      return { ok: false, status: 409, message: "Upload session is no longer active." };
    }
    if (request.headers.get("content-type")?.split(";")[0] !== session.mimeType) {
      return { ok: false, status: 400, message: "Content type does not match the declaration." };
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > session.byteSize) {
      return { ok: false, status: 413, message: "Upload exceeds the declared byte size." };
    }
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength !== session.byteSize) {
      return { ok: false, status: 400, message: "Byte size does not match the declaration." };
    }
    const checksum = hex(await crypto.subtle.digest("SHA-256", bytes));
    if (checksum !== session.checksumSha256) {
      await this.db
        .update(uploadSessions)
        .set({ status: "failed", failureReason: "Checksum mismatch", updatedAt: this.clock() })
        .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.status, "pending")));
      return { ok: false, status: 400, message: "Checksum does not match the declaration." };
    }
    await this.env.MEDIA_BUCKET.put(session.objectKey, bytes, {
      httpMetadata: { contentType: session.mimeType },
      customMetadata: { checksumSha256: checksum, uploadSessionId: session.id },
    });
    return { ok: true, value: null };
  }

  async complete(sessionId: string): Promise<MediaResult<{ assetId: string }>> {
    const [session] = await this.db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, sessionId))
      .limit(1);
    if (!session) return { ok: false, status: 404, message: "Upload session not found." };
    if (session.status !== "pending") {
      return { ok: false, status: 409, message: "Upload session has already been finalized." };
    }
    const object = await this.env.MEDIA_BUCKET.head(session.objectKey);
    if (
      !object ||
      object.size !== session.byteSize ||
      object.customMetadata?.checksumSha256 !== session.checksumSha256
    ) {
      return { ok: false, status: 409, message: "Uploaded object is incomplete." };
    }
    const assetRows =
      session.assetKind === "artwork"
        ? await this.db
            .insert(artworkAssets)
            .values({
              objectKey: session.objectKey,
              storageProvider: "r2",
              status: "ready",
              scope: session.scope,
              mimeType: session.mimeType,
              checksumSha256: session.checksumSha256,
              byteSize: session.byteSize,
              width: session.width,
              height: session.height,
            })
            .returning({ id: artworkAssets.id })
        : await this.db
            .insert(audioAssets)
            .values({
              trackId: session.targetEntityId!,
              objectKey: session.objectKey,
              storageProvider: "r2",
              status: "ready",
              scope: session.scope,
              mimeType: session.mimeType,
              checksumSha256: session.checksumSha256,
              byteSize: session.byteSize,
              durationMs: session.durationMs!,
              codec: session.codec!,
            })
            .returning({ id: audioAssets.id });
    await this.db
      .update(uploadSessions)
      .set({ status: "completed", completedAt: this.clock(), updatedAt: this.clock() })
      .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.status, "pending")));
    return { ok: true, value: { assetId: assetRows[0].id } };
  }

  async cleanupAbandoned(): Promise<number> {
    const now = this.clock();
    const expired = await this.db
      .select({ id: uploadSessions.id, objectKey: uploadSessions.objectKey })
      .from(uploadSessions)
      .where(and(eq(uploadSessions.status, "pending"), lt(uploadSessions.expiresAt, now)));
    if (expired.length === 0) return 0;
    await Promise.all(expired.map(({ objectKey }) => this.env.MEDIA_BUCKET.delete(objectKey)));
    await this.db
      .update(uploadSessions)
      .set({ status: "abandoned", failureReason: "Expired before completion", updatedAt: now })
      .where(
        inArray(
          uploadSessions.id,
          expired.map(({ id }) => id),
        ),
      );
    return expired.length;
  }
}
