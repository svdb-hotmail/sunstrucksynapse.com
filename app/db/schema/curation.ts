import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { assetScope, catalogueLifecycle, uploadAssetKind, uploadSessionStatus } from "./enums";

export const publicationAudit = pgTable(
  "publication_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fromLifecycle: catalogueLifecycle("from_lifecycle").notNull(),
    toLifecycle: catalogueLifecycle("to_lifecycle").notNull(),
    actorEmail: text("actor_email").notNull(),
    actorId: text("actor_id").notNull(),
    reason: text("reason"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("publication_audit_entity_history_idx").on(
      table.entityType,
      table.entityId,
      table.occurredAt,
      table.id,
    ),
    index("publication_audit_actor_idx").on(table.actorId, table.occurredAt),
    check(
      "publication_audit_entity_type_check",
      sql`${table.entityType} in ('artist', 'release', 'track', 'collection')`,
    ),
    check(
      "publication_audit_reason_check",
      sql`${table.toLifecycle} not in ('published', 'archived') or nullif(btrim(${table.reason}), '') is not null`,
    ),
  ],
);

export const uploadSessions = pgTable(
  "upload_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetKind: uploadAssetKind("asset_kind").notNull(),
    targetEntityId: uuid("target_entity_id"),
    objectKey: text("object_key").notNull(),
    scope: assetScope("scope").notNull(),
    status: uploadSessionStatus("status").default("pending").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    codec: text("codec"),
    actorEmail: text("actor_email").notNull(),
    actorId: text("actor_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("upload_sessions_object_key_unique").on(table.objectKey),
    index("upload_sessions_cleanup_idx").on(table.status, table.expiresAt),
    index("upload_sessions_actor_idx").on(table.actorId, table.createdAt),
    check("upload_sessions_checksum_check", sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    check("upload_sessions_byte_size_check", sql`${table.byteSize} > 0`),
    check(
      "upload_sessions_metadata_check",
      sql`(
        (${table.assetKind} = 'artwork' and ${table.width} > 0 and ${table.height} > 0 and ${table.durationMs} is null and ${table.codec} is null and ${table.mimeType} ~ '^image/')
        or
        (${table.assetKind} = 'audio' and ${table.width} is null and ${table.height} is null and ${table.durationMs} > 0 and nullif(btrim(${table.codec}), '') is not null and ${table.mimeType} ~ '^audio/')
      )`,
    ),
    check(
      "upload_sessions_state_check",
      sql`(
        (${table.status} = 'pending' and ${table.completedAt} is null and ${table.failureReason} is null)
        or (${table.status} = 'completed' and ${table.completedAt} is not null and ${table.failureReason} is null)
        or (${table.status} in ('abandoned', 'failed') and ${table.completedAt} is null)
      )`,
    ),
  ],
);
