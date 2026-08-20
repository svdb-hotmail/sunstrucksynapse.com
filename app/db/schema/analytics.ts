import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { editorialCollections } from "./editorial";
import { tracks } from "./catalogue";

export const playbackEvents = pgTable(
  "playback_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull(),
    eventName: text("event_name").notNull(),
    anonymousSessionHash: text("anonymous_session_hash").notNull(),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
    collectionId: uuid("collection_id").references(() => editorialCollections.id, {
      onDelete: "set null",
    }),
    progressSeconds: integer("progress_seconds"),
    isBot: integer("is_bot").default(0).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("playback_events_event_id_unique").on(table.eventId),
    index("playback_events_occurred_at_idx").on(table.occurredAt),
    index("playback_events_track_idx").on(table.trackId, table.occurredAt),
    index("playback_events_collection_idx").on(table.collectionId, table.occurredAt),
    check(
      "playback_events_name_check",
      sql`${table.eventName} in ('catalogue_impression', 'collection_view', 'play_requested', 'playback_started', 'listen_30_seconds', 'completion', 'skip', 'replay', 'playback_error', 'share', 'outbound_artist_click')`,
    ),
    check(
      "playback_events_session_hash_check",
      sql`${table.anonymousSessionHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "playback_events_progress_check",
      sql`${table.progressSeconds} is null or ${table.progressSeconds} >= 0`,
    ),
    check("playback_events_bot_check", sql`${table.isBot} in (0, 1)`),
  ],
);
