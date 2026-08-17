import postgres from "postgres";

import { validateDatabaseEnv } from "../app/config/env.server";

const { DATABASE_URL } = validateDatabaseEnv(process.env);
const sql = postgres(DATABASE_URL, { max: 1, prepare: false });

try {
  const [summary] = await sql<
    {
      artists: number;
      tracks: number;
      collections: number;
      incomplete_metadata: number;
      missing_media: number;
      missing_artwork: number;
      missing_review: number;
    }[]
  >`
    select
      (select count(*)::int from artists where lifecycle_status = 'published') as artists,
      (select count(*)::int from tracks where lifecycle_status = 'published') as tracks,
      (select count(*)::int from editorial_collections where lifecycle_status = 'published') as collections,
      (
        select count(*)::int from tracks
        where lifecycle_status = 'published'
          and (genre is null or cardinality(moods) = 0 or cardinality(creative_process_tags) = 0)
      ) as incomplete_metadata,
      (
        select count(*)::int from tracks t
        where t.lifecycle_status = 'published'
          and not exists (
            select 1 from audio_assets a
            where a.track_id = t.id and a.scope = 'publishable_derivative' and a.status = 'ready'
            union all
            select 1 from video_assets v
            where v.track_id = t.id and v.scope = 'publishable_derivative' and v.status = 'ready'
          )
      ) as missing_media,
      (
        select count(*)::int from tracks t
        where t.lifecycle_status = 'published'
          and not exists (
            select 1 from track_artwork_assets ta
            join artwork_assets a on a.id = ta.artwork_asset_id
            where ta.track_id = t.id and ta.role = 'primary'
              and a.scope = 'publishable_derivative' and a.status = 'ready'
          )
      ) as missing_artwork,
      (
        select count(*)::int from tracks t
        where t.lifecycle_status = 'published'
          and not exists (
            select 1 from submissions s
            where s.resulting_track_id = t.id
              and s.status = 'accepted'
              and s.accepted_rights_declaration_id is not null
              and s.accepted_process_disclosure_id is not null
              and s.accepted_provenance_record_id is not null
          )
      ) as missing_review
  `;
  if (!summary) throw new Error("Catalogue readiness query returned no result.");
  const checks = {
    artistTarget: summary.artists >= 10 && summary.artists <= 20,
    trackTarget: summary.tracks >= 30 && summary.tracks <= 50,
    collectionTarget: summary.collections >= 5,
    completeMetadata: summary.incomplete_metadata === 0,
    completeMedia: summary.missing_media === 0,
    completeArtwork: summary.missing_artwork === 0,
    completeRightsAndProvenance: summary.missing_review === 0,
  };
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), summary, checks }, null, 2));
  if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
} finally {
  await sql.end();
}
