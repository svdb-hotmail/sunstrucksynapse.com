import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  artworkRole,
  assetScope,
  catalogueLifecycle,
  managedAssetStatus,
  storageProvider,
} from "./enums";
import { timestamps } from "./helpers";

const lifecycleCheck = (
  status: unknown,
  scheduledFor: unknown,
  publishedAt: unknown,
  archivedAt: unknown,
) =>
  sql`(
    (${status} in ('draft', 'in_review') and ${scheduledFor} is null and ${publishedAt} is null and ${archivedAt} is null)
    or (${status} = 'scheduled' and ${scheduledFor} is not null and ${publishedAt} is null and ${archivedAt} is null)
    or (${status} = 'published' and ${publishedAt} is not null and ${archivedAt} is null)
    or (${status} = 'archived' and ${archivedAt} is not null)
  )`;

export const artworkAssets = pgTable(
  "artwork_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    objectKey: text("object_key").notNull(),
    storageProvider: storageProvider("storage_provider").default("static").notNull(),
    status: managedAssetStatus("status").default("ready").notNull(),
    scope: assetScope("scope").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("artwork_assets_object_key_unique").on(table.objectKey),
    index("artwork_assets_scope_idx").on(table.scope),
    index("artwork_assets_delivery_idx").on(table.storageProvider, table.status, table.scope),
    check("artwork_assets_checksum_sha256_check", sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    check("artwork_assets_byte_size_check", sql`${table.byteSize} > 0`),
    check(
      "artwork_assets_dimensions_check",
      sql`(${table.width} is null and ${table.height} is null) or (${table.width} is not null and ${table.height} is not null and ${table.width} > 0 and ${table.height} > 0)`,
    ),
  ],
);

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    biography: text("biography"),
    lifecycleStatus: catalogueLifecycle("lifecycle_status").default("draft").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("artists_slug_unique").on(table.slug),
    index("artists_lifecycle_queue_idx").on(table.lifecycleStatus, table.scheduledFor),
    check("artists_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    check(
      "artists_lifecycle_check",
      lifecycleCheck(
        table.lifecycleStatus,
        table.scheduledFor,
        table.publishedAt,
        table.archivedAt,
      ),
    ),
    check(
      "artists_publication_order_check",
      sql`${table.publishedAt} is null or ${table.scheduledFor} is null or ${table.publishedAt} >= ${table.scheduledFor}`,
    ),
  ],
);

export const artistArtworkAssets = pgTable(
  "artist_artwork_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    artworkAssetId: uuid("artwork_asset_id")
      .notNull()
      .references(() => artworkAssets.id, { onDelete: "restrict" }),
    role: artworkRole("role").default("gallery").notNull(),
    position: integer("position").default(1).notNull(),
    altText: text("alt_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("artist_artwork_assets_position_unique").on(table.artistId, table.role, table.position),
    unique("artist_artwork_assets_asset_unique").on(
      table.artistId,
      table.artworkAssetId,
      table.role,
    ),
    index("artist_artwork_assets_artist_id_idx").on(table.artistId),
    index("artist_artwork_assets_artwork_asset_id_idx").on(table.artworkAssetId),
    check("artist_artwork_assets_position_check", sql`${table.position} > 0`),
  ],
);

export const releases = pgTable(
  "releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    releaseDate: timestamp("release_date", { withTimezone: true }),
    lifecycleStatus: catalogueLifecycle("lifecycle_status").default("draft").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("releases_slug_unique").on(table.slug),
    index("releases_lifecycle_queue_idx").on(table.lifecycleStatus, table.scheduledFor),
    check("releases_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    check(
      "releases_lifecycle_check",
      lifecycleCheck(
        table.lifecycleStatus,
        table.scheduledFor,
        table.publishedAt,
        table.archivedAt,
      ),
    ),
    check(
      "releases_publication_order_check",
      sql`${table.publishedAt} is null or ${table.scheduledFor} is null or ${table.publishedAt} >= ${table.scheduledFor}`,
    ),
  ],
);

export const releaseArtistCredits = pgTable(
  "release_artist_credits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    creditedAs: text("credited_as"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("release_artist_credits_position_unique").on(table.releaseId, table.position),
    unique("release_artist_credits_artist_unique").on(table.releaseId, table.artistId),
    index("release_artist_credits_release_id_idx").on(table.releaseId),
    index("release_artist_credits_artist_id_idx").on(table.artistId),
    check("release_artist_credits_position_check", sql`${table.position} > 0`),
  ],
);

export const releaseArtworkAssets = pgTable(
  "release_artwork_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    artworkAssetId: uuid("artwork_asset_id")
      .notNull()
      .references(() => artworkAssets.id, { onDelete: "restrict" }),
    role: artworkRole("role").default("gallery").notNull(),
    position: integer("position").default(1).notNull(),
    altText: text("alt_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("release_artwork_assets_position_unique").on(
      table.releaseId,
      table.role,
      table.position,
    ),
    unique("release_artwork_assets_asset_unique").on(
      table.releaseId,
      table.artworkAssetId,
      table.role,
    ),
    index("release_artwork_assets_release_id_idx").on(table.releaseId),
    index("release_artwork_assets_artwork_asset_id_idx").on(table.artworkAssetId),
    check("release_artwork_assets_position_check", sql`${table.position} > 0`),
  ],
);

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    genre: text("genre"),
    moods: text("moods")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    creativeProcessTags: text("creative_process_tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    discNumber: integer("disc_number").default(1).notNull(),
    position: integer("position").notNull(),
    lifecycleStatus: catalogueLifecycle("lifecycle_status").default("draft").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    unique("tracks_release_slug_unique").on(table.releaseId, table.slug),
    unique("tracks_release_order_unique").on(table.releaseId, table.discNumber, table.position),
    index("tracks_release_id_idx").on(table.releaseId),
    index("tracks_slug_idx").on(table.slug),
    index("tracks_release_order_idx").on(table.releaseId, table.discNumber, table.position),
    index("tracks_lifecycle_queue_idx").on(table.lifecycleStatus, table.scheduledFor),
    check("tracks_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    check("tracks_order_check", sql`${table.discNumber} > 0 and ${table.position} > 0`),
    check(
      "tracks_lifecycle_check",
      lifecycleCheck(
        table.lifecycleStatus,
        table.scheduledFor,
        table.publishedAt,
        table.archivedAt,
      ),
    ),
    check(
      "tracks_publication_order_check",
      sql`${table.publishedAt} is null or ${table.scheduledFor} is null or ${table.publishedAt} >= ${table.scheduledFor}`,
    ),
  ],
);

export const trackArtistCredits = pgTable(
  "track_artist_credits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    creditedAs: text("credited_as"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("track_artist_credits_position_unique").on(table.trackId, table.position),
    unique("track_artist_credits_artist_unique").on(table.trackId, table.artistId),
    index("track_artist_credits_track_id_idx").on(table.trackId),
    index("track_artist_credits_artist_id_idx").on(table.artistId),
    check("track_artist_credits_position_check", sql`${table.position} > 0`),
  ],
);

export const trackArtworkAssets = pgTable(
  "track_artwork_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    artworkAssetId: uuid("artwork_asset_id")
      .notNull()
      .references(() => artworkAssets.id, { onDelete: "restrict" }),
    role: artworkRole("role").default("gallery").notNull(),
    position: integer("position").default(1).notNull(),
    altText: text("alt_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("track_artwork_assets_position_unique").on(table.trackId, table.role, table.position),
    unique("track_artwork_assets_asset_unique").on(table.trackId, table.artworkAssetId, table.role),
    index("track_artwork_assets_track_id_idx").on(table.trackId),
    index("track_artwork_assets_artwork_asset_id_idx").on(table.artworkAssetId),
    check("track_artwork_assets_position_check", sql`${table.position} > 0`),
  ],
);

export const audioAssets = pgTable(
  "audio_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict" }),
    objectKey: text("object_key").notNull(),
    storageProvider: storageProvider("storage_provider").default("static").notNull(),
    status: managedAssetStatus("status").default("ready").notNull(),
    scope: assetScope("scope").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    codec: text("codec").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("audio_assets_object_key_unique").on(table.objectKey),
    uniqueIndex("audio_assets_track_scope_primary_unique")
      .on(table.trackId, table.scope)
      .where(sql`${table.isPrimary}`),
    index("audio_assets_track_id_idx").on(table.trackId),
    index("audio_assets_scope_idx").on(table.scope),
    index("audio_assets_delivery_idx").on(table.storageProvider, table.status, table.scope),
    check("audio_assets_checksum_sha256_check", sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    check("audio_assets_byte_size_check", sql`${table.byteSize} > 0`),
    check("audio_assets_duration_check", sql`${table.durationMs} > 0`),
    check("audio_assets_mime_type_check", sql`${table.mimeType} ~ '^audio/'`),
  ],
);

export const videoAssets = pgTable(
  "video_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict" }),
    objectKey: text("object_key").notNull(),
    storageProvider: storageProvider("storage_provider").default("static").notNull(),
    status: managedAssetStatus("status").default("ready").notNull(),
    scope: assetScope("scope").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    codec: text("codec").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("video_assets_object_key_unique").on(table.objectKey),
    uniqueIndex("video_assets_track_scope_primary_unique")
      .on(table.trackId, table.scope)
      .where(sql`${table.isPrimary}`),
    index("video_assets_track_id_idx").on(table.trackId),
    index("video_assets_scope_idx").on(table.scope),
    index("video_assets_delivery_idx").on(table.storageProvider, table.status, table.scope),
    check("video_assets_checksum_sha256_check", sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    check("video_assets_byte_size_check", sql`${table.byteSize} > 0`),
    check("video_assets_duration_check", sql`${table.durationMs} > 0`),
    check("video_assets_mime_type_check", sql`${table.mimeType} ~ '^video/'`),
  ],
);
