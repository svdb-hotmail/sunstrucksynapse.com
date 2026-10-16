import { sql } from "drizzle-orm";
import { publishedCatalogueRow } from "~/services/catalogue-visibility.server";

export interface ReleasePublicationState {
  trackCount: number;
  liveTrackCount: number;
  complete: boolean;
}

export function releasePublicationStateQuery(releaseId: string) {
  return sql`select count(*)::int as "trackCount",count(*) filter(where visible and media)::int as "liveTrackCount",
    (count(*)>0 and bool_and(visible and media)) as complete from (
      select exists(select 1 from track_artist_credits c join artists a on a.id=c.artist_id
        where c.track_id=t.id and ${publishedCatalogueRow(sql`t.lifecycle_status`, sql`r.lifecycle_status`, sql`a.lifecycle_status`)}) as visible,
      (exists(select 1 from audio_assets a where a.track_id=t.id and a.is_primary and a.scope='publishable_derivative' and a.status='ready')
        or exists(select 1 from video_assets a where a.track_id=t.id and a.is_primary and a.scope='publishable_derivative' and a.status='ready')) as media
      from tracks t join releases r on r.id=t.release_id where t.release_id=${releaseId}::uuid
    ) state`;
}
