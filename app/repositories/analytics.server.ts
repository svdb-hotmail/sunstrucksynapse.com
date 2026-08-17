import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import {
  artists,
  editorialCollections,
  playbackEvents,
  releases,
  trackArtistCredits,
  tracks,
} from "~/db/schema";
import * as schema from "~/db/schema";
import type { AnalyticsSummaryRow, PlaybackEventInput } from "~/types/analytics";

export type AnalyticsGroup = "track" | "artist" | "release" | "collection";

export interface AnalyticsRepository {
  record(
    input: Omit<PlaybackEventInput, "anonymousSessionId"> & {
      anonymousSessionHash: string;
      isBot: boolean;
    },
  ): Promise<"recorded" | "duplicate">;
  summarize(group: AnalyticsGroup, from: Date, to: Date): Promise<AnalyticsSummaryRow[]>;
  purgeBefore(cutoff: Date): Promise<number>;
}

export function createMemoryAnalyticsRepository(): AnalyticsRepository {
  const events = new Map<
    string,
    Omit<PlaybackEventInput, "anonymousSessionId"> & {
      anonymousSessionHash: string;
      isBot: boolean;
    }
  >();
  return {
    async record(input) {
      if (events.has(input.eventId)) return "duplicate";
      events.set(input.eventId, input);
      return "recorded";
    },
    async summarize() {
      return [];
    },
    async purgeBefore(cutoff) {
      let deleted = 0;
      for (const [id, event] of events) {
        if (new Date(event.occurredAt) < cutoff) {
          events.delete(id);
          deleted += 1;
        }
      }
      return deleted;
    },
  };
}

export function createAnalyticsRepository<TQueryResult extends PgQueryResultHKT>(
  db: PgDatabase<TQueryResult, typeof schema>,
): AnalyticsRepository {
  return {
    async record(input) {
      const [track, collection] = await Promise.all([
        input.trackId
          ? db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, input.trackId)).limit(1)
          : [],
        input.collectionId
          ? db
              .select({ id: editorialCollections.id })
              .from(editorialCollections)
              .where(eq(editorialCollections.id, input.collectionId))
              .limit(1)
          : [],
      ]);
      const rows = await db
        .insert(playbackEvents)
        .values({
          eventId: input.eventId,
          eventName: input.eventName,
          anonymousSessionHash: input.anonymousSessionHash,
          trackId: track[0]?.id,
          collectionId: collection[0]?.id,
          progressSeconds: input.progressSeconds,
          isBot: input.isBot ? 1 : 0,
          occurredAt: new Date(input.occurredAt),
        })
        .onConflictDoNothing({ target: playbackEvents.eventId })
        .returning({ id: playbackEvents.id });
      return rows.length ? "recorded" : "duplicate";
    },
    async summarize(group, from, to) {
      const dimension =
        group === "track"
          ? { id: tracks.id, name: tracks.title }
          : group === "release"
            ? { id: releases.id, name: releases.title }
            : group === "artist"
              ? { id: artists.id, name: artists.displayName }
              : { id: editorialCollections.id, name: editorialCollections.name };
      const base = db
        .select({
          id: dimension.id,
          name: dimension.name,
          starts: sql<number>`count(*) filter (where ${playbackEvents.eventName} = 'playback_started')::int`,
          listens30: sql<number>`count(*) filter (where ${playbackEvents.eventName} = 'listen_30_seconds')::int`,
          completions: sql<number>`count(*) filter (where ${playbackEvents.eventName} = 'completion')::int`,
          skips: sql<number>`count(*) filter (where ${playbackEvents.eventName} = 'skip')::int`,
          replays: sql<number>`count(*) filter (where ${playbackEvents.eventName} = 'replay')::int`,
        })
        .from(playbackEvents);
      const joined =
        group === "track"
          ? base.innerJoin(tracks, eq(playbackEvents.trackId, tracks.id))
          : group === "release"
            ? base
                .innerJoin(tracks, eq(playbackEvents.trackId, tracks.id))
                .innerJoin(releases, eq(tracks.releaseId, releases.id))
            : group === "artist"
              ? base
                  .innerJoin(tracks, eq(playbackEvents.trackId, tracks.id))
                  .innerJoin(trackArtistCredits, eq(trackArtistCredits.trackId, tracks.id))
                  .innerJoin(artists, eq(trackArtistCredits.artistId, artists.id))
              : base.innerJoin(
                  editorialCollections,
                  eq(playbackEvents.collectionId, editorialCollections.id),
                );
      return joined
        .where(
          and(
            gte(playbackEvents.occurredAt, from),
            lte(playbackEvents.occurredAt, to),
            eq(playbackEvents.isBot, 0),
          ),
        )
        .groupBy(dimension.id, dimension.name)
        .orderBy(sql`2 asc`);
    },
    async purgeBefore(cutoff) {
      const rows = await db
        .delete(playbackEvents)
        .where(lt(playbackEvents.receivedAt, cutoff))
        .returning({ id: playbackEvents.id });
      return rows.length;
    },
  };
}
