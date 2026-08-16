import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { WorkerEnv } from "~/config/env.server";
import { artists, editorialCollections, releases, tracks, uploadSessions } from "~/db/schema";
import * as schema from "~/db/schema";
import type { CuratorIdentity } from "~/types/curator";
import { IncrementalSha256 } from "~/utils/sha256";

export type UploadKind = "artwork" | "audio";
export type AssetScope = "private_master" | "publishable_derivative";
export type TargetEntityType = "artist" | "release" | "track" | "collection";

export interface UploadDeclaration {
  kind: UploadKind;
  targetEntityType: TargetEntityType;
  targetEntityId: string;
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
const validTargetEntityTypes = new Set<string>(["artist", "release", "track", "collection"]);
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTargetEntityType(value: unknown): value is TargetEntityType {
  return (
    typeof value === "string" &&
    (value === "artist" || value === "release" || value === "track" || value === "collection")
  );
}

function createFixedLengthStream(expectedSize: number): {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
} {
  const globalClass = Reflect.get(globalThis, "FixedLengthStream");
  if (typeof globalClass === "function") {
    return new globalClass(expectedSize);
  }
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  return { readable: ts.readable, writable: ts.writable };
}

export function validateUploadDeclaration(
  input: UploadDeclaration,
): MediaResult<UploadDeclaration> {
  if (!allowedMimeTypes[input.kind]?.has(input.mimeType)) {
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
  if (!input.targetEntityType || !validTargetEntityTypes.has(input.targetEntityType)) {
    return { ok: false, status: 400, message: "A valid target entity type is required." };
  }
  if (!input.targetEntityId || !uuidRegex.test(input.targetEntityId)) {
    return { ok: false, status: 400, message: "A valid target entity ID is required." };
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
    (input.targetEntityType !== "track" ||
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
  const targetEntityTypeRaw =
    optionalString("targetEntityType") ??
    optionalString("targetType") ??
    optionalString("entityType") ??
    (kind === "audio" ? "track" : undefined);

  if (!isTargetEntityType(targetEntityTypeRaw)) {
    return { ok: false, status: 400, message: "A valid target entity type is required." };
  }

  const targetEntityId =
    optionalString("targetEntityId") ?? (kind === "audio" ? optionalString("trackId") : undefined);

  if (!targetEntityId || !uuidRegex.test(targetEntityId)) {
    return { ok: false, status: 400, message: "A valid target entity ID is required." };
  }

  return validateUploadDeclaration({
    kind,
    scope,
    mimeType,
    checksumSha256,
    byteSize,
    targetEntityType: targetEntityTypeRaw,
    targetEntityId,
    width: optionalNumber("width"),
    height: optionalNumber("height"),
    durationMs: optionalNumber("durationMs"),
    codec: optionalString("codec"),
  });
}

export class MediaService<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> {
  constructor(
    private readonly db: PgDatabase<TQueryResult, typeof schema>,
    private readonly env: WorkerEnv,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async targetExists(
    targetEntityType: TargetEntityType,
    targetEntityId: string,
  ): Promise<boolean> {
    if (targetEntityType === "artist") {
      const [row] = await this.db
        .select({ id: artists.id })
        .from(artists)
        .where(eq(artists.id, targetEntityId))
        .limit(1);
      return Boolean(row);
    }
    if (targetEntityType === "release") {
      const [row] = await this.db
        .select({ id: releases.id })
        .from(releases)
        .where(eq(releases.id, targetEntityId))
        .limit(1);
      return Boolean(row);
    }
    if (targetEntityType === "track") {
      const [row] = await this.db
        .select({ id: tracks.id })
        .from(tracks)
        .where(eq(tracks.id, targetEntityId))
        .limit(1);
      return Boolean(row);
    }
    if (targetEntityType === "collection") {
      const [row] = await this.db
        .select({ id: editorialCollections.id })
        .from(editorialCollections)
        .where(eq(editorialCollections.id, targetEntityId))
        .limit(1);
      return Boolean(row);
    }
    return false;
  }

  async createSession(
    declaration: UploadDeclaration,
    actor: CuratorIdentity,
  ): Promise<MediaResult<{ id: string; expiresAt: string }>> {
    const validated = validateUploadDeclaration(declaration);
    if (!validated.ok) return validated;
    const targetFound = await this.targetExists(
      declaration.targetEntityType,
      declaration.targetEntityId,
    );
    if (!targetFound) {
      return {
        ok: false,
        status: 404,
        message: `Target ${declaration.targetEntityType} not found.`,
      };
    }
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const prefix = declaration.scope === "private_master" ? "private" : "publishable";
    const objectKey = `${prefix}/${declaration.kind}/${crypto.randomUUID()}`;
    const [row] = await this.db
      .insert(uploadSessions)
      .values({
        assetKind: declaration.kind,
        targetEntityType: declaration.targetEntityType,
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
    if (!request.body) {
      return { ok: false, status: 400, message: "Upload body is required." };
    }

    const { readable, writable } = createFixedLengthStream(session.byteSize);
    const sha256Hasher = new IncrementalSha256();
    let streamedByteCount = 0;
    let pumpError: Error | null = null;

    const pumpPromise = (async () => {
      const reader = request.body!.getReader();
      const writer = writable.getWriter();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            streamedByteCount += value.byteLength;
            sha256Hasher.update(value);
            await writer.write(value);
          }
        }
        await writer.close();
      } catch (err) {
        pumpError = err instanceof Error ? err : new Error(String(err));
        await writer.abort(pumpError);
      } finally {
        reader.releaseLock();
      }
    })();

    let stored;
    try {
      const putPromise = this.env.MEDIA_BUCKET.put(session.objectKey, readable, {
        httpMetadata: { contentType: session.mimeType },
        customMetadata: {
          checksumSha256: session.checksumSha256,
          uploadSessionId: session.id,
        },
        sha256: session.checksumSha256,
      });

      const [putResult] = await Promise.all([putPromise, pumpPromise]);
      stored = putResult;
    } catch (error) {
      if (!(error instanceof Error) || !/checksum|sha-?256/i.test(error.message)) {
        throw error;
      }
      await this.db
        .update(uploadSessions)
        .set({ status: "failed", failureReason: "Checksum mismatch", updatedAt: this.clock() })
        .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.status, "pending")));
      return { ok: false, status: 400, message: "Checksum does not match the declaration." };
    }

    if (pumpError) {
      await this.env.MEDIA_BUCKET.delete(session.objectKey);
      return { ok: false, status: 400, message: "Upload streaming failed." };
    }

    const computedChecksum = sha256Hasher.digestHex();
    if (computedChecksum !== session.checksumSha256) {
      await this.env.MEDIA_BUCKET.delete(session.objectKey);
      await this.db
        .update(uploadSessions)
        .set({ status: "failed", failureReason: "Checksum mismatch", updatedAt: this.clock() })
        .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.status, "pending")));
      return { ok: false, status: 400, message: "Checksum does not match the declaration." };
    }

    if (streamedByteCount !== session.byteSize || (stored && stored.size !== session.byteSize)) {
      await this.env.MEDIA_BUCKET.delete(session.objectKey);
      return { ok: false, status: 400, message: "Byte size does not match the declaration." };
    }

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
    if (session.expiresAt <= this.clock()) {
      return { ok: false, status: 409, message: "Upload session has expired." };
    }
    const object = await this.env.MEDIA_BUCKET.head(session.objectKey);
    if (
      !object ||
      object.size !== session.byteSize ||
      object.customMetadata?.checksumSha256 !== session.checksumSha256
    ) {
      return { ok: false, status: 409, message: "Uploaded object is incomplete." };
    }

    const targetEntityType = session.targetEntityType;
    const targetEntityId = session.targetEntityId;
    const targetExists = await this.targetExists(targetEntityType, targetEntityId);
    if (!targetExists) {
      return { ok: false, status: 404, message: `Target ${targetEntityType} not found.` };
    }

    const assetId = crypto.randomUUID();
    const now = this.clock();

    if (session.assetKind === "artwork") {
      if (targetEntityType === "artist") {
        await this.db.execute(sql`
          WITH ins_asset AS (
            INSERT INTO artwork_assets (
              id, object_key, storage_provider, status, scope, mime_type, checksum_sha256, byte_size, width, height, created_at, updated_at
            ) VALUES (
              ${assetId}, ${session.objectKey}, 'r2', 'ready', ${session.scope}, ${session.mimeType}, ${session.checksumSha256}, ${session.byteSize}, ${session.width}, ${session.height}, ${now}, ${now}
            )
            RETURNING id
          ),
          ins_rel AS (
            INSERT INTO artist_artwork_assets (
              artist_id, artwork_asset_id, role, position, created_at
            ) SELECT ${targetEntityId}, ${assetId}, 'avatar', 1, ${now}
            WHERE ${session.scope} = 'publishable_derivative'
            ON CONFLICT (artist_id, role, position)
            DO UPDATE SET artwork_asset_id = EXCLUDED.artwork_asset_id
            RETURNING id
          ),
          upd_session AS (
            UPDATE upload_sessions
            SET status = 'completed', completed_at = ${now}, updated_at = ${now}
            WHERE id = ${sessionId} AND status = 'pending'
            RETURNING id
          )
          SELECT id FROM ins_asset
        `);
      } else if (targetEntityType === "release") {
        await this.db.execute(sql`
          WITH ins_asset AS (
            INSERT INTO artwork_assets (
              id, object_key, storage_provider, status, scope, mime_type, checksum_sha256, byte_size, width, height, created_at, updated_at
            ) VALUES (
              ${assetId}, ${session.objectKey}, 'r2', 'ready', ${session.scope}, ${session.mimeType}, ${session.checksumSha256}, ${session.byteSize}, ${session.width}, ${session.height}, ${now}, ${now}
            )
            RETURNING id
          ),
          ins_rel AS (
            INSERT INTO release_artwork_assets (
              release_id, artwork_asset_id, role, position, created_at
            ) SELECT ${targetEntityId}, ${assetId}, 'primary', 1, ${now}
            WHERE ${session.scope} = 'publishable_derivative'
            ON CONFLICT (release_id, role, position)
            DO UPDATE SET artwork_asset_id = EXCLUDED.artwork_asset_id
            RETURNING id
          ),
          upd_session AS (
            UPDATE upload_sessions
            SET status = 'completed', completed_at = ${now}, updated_at = ${now}
            WHERE id = ${sessionId} AND status = 'pending'
            RETURNING id
          )
          SELECT id FROM ins_asset
        `);
      } else if (targetEntityType === "track") {
        await this.db.execute(sql`
          WITH ins_asset AS (
            INSERT INTO artwork_assets (
              id, object_key, storage_provider, status, scope, mime_type, checksum_sha256, byte_size, width, height, created_at, updated_at
            ) VALUES (
              ${assetId}, ${session.objectKey}, 'r2', 'ready', ${session.scope}, ${session.mimeType}, ${session.checksumSha256}, ${session.byteSize}, ${session.width}, ${session.height}, ${now}, ${now}
            )
            RETURNING id
          ),
          ins_rel AS (
            INSERT INTO track_artwork_assets (
              track_id, artwork_asset_id, role, position, created_at
            ) SELECT ${targetEntityId}, ${assetId}, 'primary', 1, ${now}
            WHERE ${session.scope} = 'publishable_derivative'
            ON CONFLICT (track_id, role, position)
            DO UPDATE SET artwork_asset_id = EXCLUDED.artwork_asset_id
            RETURNING id
          ),
          upd_session AS (
            UPDATE upload_sessions
            SET status = 'completed', completed_at = ${now}, updated_at = ${now}
            WHERE id = ${sessionId} AND status = 'pending'
            RETURNING id
          )
          SELECT id FROM ins_asset
        `);
      } else if (targetEntityType === "collection") {
        await this.db.execute(sql`
          WITH ins_asset AS (
            INSERT INTO artwork_assets (
              id, object_key, storage_provider, status, scope, mime_type, checksum_sha256, byte_size, width, height, created_at, updated_at
            ) VALUES (
              ${assetId}, ${session.objectKey}, 'r2', 'ready', ${session.scope}, ${session.mimeType}, ${session.checksumSha256}, ${session.byteSize}, ${session.width}, ${session.height}, ${now}, ${now}
            )
            RETURNING id
          ),
          upd_coll AS (
            UPDATE editorial_collections
            SET artwork_asset_id = ${assetId}, updated_at = ${now}
            WHERE id = ${targetEntityId} AND ${session.scope} = 'publishable_derivative'
            RETURNING id
          ),
          upd_session AS (
            UPDATE upload_sessions
            SET status = 'completed', completed_at = ${now}, updated_at = ${now}
            WHERE id = ${sessionId} AND status = 'pending'
            RETURNING id
          )
          SELECT id FROM ins_asset
        `);
      }
    } else {
      const isPrimary = session.scope === "publishable_derivative";
      if (isPrimary) {
        await this.db.execute(sql`
          WITH upsert_audio AS (
            INSERT INTO audio_assets (
              id, track_id, object_key, storage_provider, status, scope, mime_type, checksum_sha256, byte_size, duration_ms, codec, is_primary, created_at, updated_at
            ) VALUES (
              ${assetId}, ${targetEntityId}, ${session.objectKey}, 'r2', 'ready', ${session.scope}, ${session.mimeType}, ${session.checksumSha256}, ${session.byteSize}, ${session.durationMs}, ${session.codec}, true, ${now}, ${now}
            )
            ON CONFLICT (track_id, scope) WHERE is_primary
            DO UPDATE SET
              id = EXCLUDED.id,
              object_key = EXCLUDED.object_key,
              storage_provider = EXCLUDED.storage_provider,
              status = EXCLUDED.status,
              mime_type = EXCLUDED.mime_type,
              checksum_sha256 = EXCLUDED.checksum_sha256,
              byte_size = EXCLUDED.byte_size,
              duration_ms = EXCLUDED.duration_ms,
              codec = EXCLUDED.codec,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
            RETURNING id
          ),
          upd_session AS (
            UPDATE upload_sessions
            SET status = 'completed', completed_at = ${now}, updated_at = ${now}
            WHERE id = ${sessionId} AND status = 'pending'
            RETURNING id
          )
          SELECT id FROM upsert_audio
        `);
      } else {
        await this.db.execute(sql`
          WITH ins_audio AS (
            INSERT INTO audio_assets (
              id, track_id, object_key, storage_provider, status, scope, mime_type, checksum_sha256, byte_size, duration_ms, codec, is_primary, created_at, updated_at
            ) VALUES (
              ${assetId}, ${targetEntityId}, ${session.objectKey}, 'r2', 'ready', ${session.scope}, ${session.mimeType}, ${session.checksumSha256}, ${session.byteSize}, ${session.durationMs}, ${session.codec}, false, ${now}, ${now}
            )
            RETURNING id
          ),
          upd_session AS (
            UPDATE upload_sessions
            SET status = 'completed', completed_at = ${now}, updated_at = ${now}
            WHERE id = ${sessionId} AND status = 'pending'
            RETURNING id
          )
          SELECT id FROM ins_audio
        `);
      }
    }

    return { ok: true, value: { assetId } };
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
