import { and, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { artists, releases, tracks } from "../db/schema";

// A public catalogue row requires this exact track/release/credited-artist join.
// Media availability is separate: the public UI intentionally retains missing-media rows.
export function publishedCatalogueRow(
  track: SQLWrapper = tracks.lifecycleStatus,
  release: SQLWrapper = releases.lifecycleStatus,
  artist: SQLWrapper = artists.lifecycleStatus,
) {
  return and(eq(artist, "published"), eq(release, "published"), eq(track, "published"));
}

export function publicListeningMedia(trackId: SQL) {
  return sql`(exists(select 1 from audio_assets a where a.track_id=${trackId} and a.is_primary and a.scope='publishable_derivative' and a.status='ready')
    or exists(select 1 from video_assets a where a.track_id=${trackId} and a.is_primary and a.scope='publishable_derivative' and a.status='ready'))`;
}
