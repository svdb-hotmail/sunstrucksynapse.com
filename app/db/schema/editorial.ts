import { sql } from "drizzle-orm";
import {
  check,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { artworkAssets, releases, tracks } from "./catalogue";
import { catalogueLifecycle } from "./enums";
import { timestamps } from "./helpers";

export const editorialCollections = pgTable(
  "editorial_collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    artworkAssetId: uuid("artwork_asset_id").references(() => artworkAssets.id, {
      onDelete: "restrict",
    }),
    showOnHomepage: boolean("show_on_homepage").default(false).notNull(),
    homepagePosition: integer("homepage_position"),
    lifecycleStatus: catalogueLifecycle("lifecycle_status").default("draft").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("editorial_collections_slug_unique").on(table.slug),
    index("editorial_collections_artwork_asset_id_idx").on(table.artworkAssetId),
    index("editorial_collections_lifecycle_queue_idx").on(
      table.lifecycleStatus,
      table.scheduledFor,
    ),
    uniqueIndex("editorial_collections_homepage_position_unique")
      .on(table.homepagePosition)
      .where(sql`${table.showOnHomepage}`),
    check("editorial_collections_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    check(
      "editorial_collections_lifecycle_check",
      sql`(
        (${table.lifecycleStatus} in ('draft', 'in_review') and ${table.scheduledFor} is null and ${table.publishedAt} is null and ${table.archivedAt} is null)
        or (${table.lifecycleStatus} = 'scheduled' and ${table.scheduledFor} is not null and ${table.publishedAt} is null and ${table.archivedAt} is null)
        or (${table.lifecycleStatus} = 'published' and ${table.publishedAt} is not null and ${table.archivedAt} is null)
        or (${table.lifecycleStatus} = 'archived' and ${table.archivedAt} is not null)
      )`,
    ),
    check(
      "editorial_collections_publication_order_check",
      sql`${table.publishedAt} is null or ${table.scheduledFor} is null or ${table.publishedAt} >= ${table.scheduledFor}`,
    ),
    check(
      "editorial_collections_homepage_config_check",
      sql`(${table.showOnHomepage} and ${table.homepagePosition} > 0) or (not ${table.showOnHomepage} and ${table.homepagePosition} is null)`,
    ),
  ],
);

export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => editorialCollections.id, { onDelete: "cascade" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "restrict" }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    annotation: text("annotation"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("collection_items_position_unique").on(table.collectionId, table.position),
    uniqueIndex("collection_items_track_unique")
      .on(table.collectionId, table.trackId)
      .where(sql`${table.trackId} is not null`),
    uniqueIndex("collection_items_release_unique")
      .on(table.collectionId, table.releaseId)
      .where(sql`${table.releaseId} is not null`),
    index("collection_items_collection_order_idx").on(table.collectionId, table.position),
    index("collection_items_track_id_idx").on(table.trackId),
    index("collection_items_release_id_idx").on(table.releaseId),
    check("collection_items_position_check", sql`${table.position} > 0`),
    check(
      "collection_items_exactly_one_target_check",
      sql`num_nonnulls(${table.trackId}, ${table.releaseId}) = 1`,
    ),
  ],
);
