import { sql, type SQL } from "drizzle-orm";
import type { Database } from "~/db/client.server";
import type { CuratorIdentity } from "~/types/curator";

export interface AlbumTrackInput {
  id: string;
  title: string;
  genre: string;
  moods: string[];
  processTags: string[];
}
export interface AlbumPreparation {
  releaseId: string;
  artistId: string;
  title: string;
  slug: string;
  tracks: AlbumTrackInput[];
}
export interface AlbumReadiness {
  id: string;
  title: string;
  blockers: string[];
}

function rows<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}
// Serialize catalogue edits during these short launch commands, including legacy writers.
// Neon HTTP batch executes all statements in one transaction; no network transaction callback.
const lockCatalogue = sql`lock table artists, releases, tracks, release_artist_credits, track_artist_credits, release_artwork_assets, track_artwork_assets, audio_assets, artwork_assets, submissions in share row exclusive mode`;

const accepted = sql`exists (
  select 1 from submissions s join curation_reviews review on review.submission_id = s.id
  join submission_review_audio private_audio on private_audio.id = review.review_audio_id and private_audio.submission_id = s.id
  join rights_declarations rights on rights.id = s.accepted_rights_declaration_id and rights.submission_id = s.id
  join creative_process_disclosures process on process.id = s.accepted_creative_process_disclosure_id and process.submission_id = s.id
  join provenance_records provenance on provenance.id = s.accepted_provenance_record_id and provenance.submission_id = s.id
  where s.resulting_track_id = t.id and s.status = 'accepted' and review.final_grade in ('A','B')
    and review.rights_declaration_id = rights.id and rights.status = 'attested'
    and review.creative_process_disclosure_id = process.id and process.status = 'finalized'
    and review.provenance_record_id = provenance.id and provenance.status = 'finalized'
)`;

function readinessQuery(releaseId: string): SQL {
  return sql`select t.id, t.title, array_remove(array[
    case when not (${accepted}) then 'accepted A/B review with exact pinned declarations and private audio' end,
    case when not exists(select 1 from audio_assets a where a.track_id=t.id and a.scope='publishable_derivative' and a.status='ready' and a.is_primary and a.duration_ms > 0) then 'ready primary public listening file' end,
    case when not exists(select 1 from track_artwork_assets l join artwork_assets a on a.id=l.artwork_asset_id where l.track_id=t.id and l.role='primary' and a.scope='publishable_derivative' and a.status='ready') then 'ready primary track cover (apply album cover)' end,
    case when nullif(btrim(t.genre),'') is null or cardinality(t.moods)=0 or cardinality(t.creative_process_tags)=0 then 'genre, moods and creative process tags' end,
    case when t.lifecycle_status not in ('draft','in_review','published') then 'track must be draft or in review' end,
    case when not exists(select 1 from track_artist_credits c where c.track_id=t.id and c.position=1) or exists(select 1 from track_artist_credits c join artists a on a.id=c.artist_id where c.track_id=t.id and a.lifecycle_status not in ('draft','in_review','published')) then 'eligible credited artists' end
  ], null)::text[] as blockers from tracks t where t.release_id=${releaseId}::uuid order by t.disc_number,t.position,t.id`;
}

export function createAlbumPublishingRepository(db: Database) {
  return {
    async inventory() {
      const result =
        await db.execute(sql`select t.id, t.title, t.release_id as "releaseId", t.genre, t.moods, t.creative_process_tags as "processTags", t.position,
        (${accepted}) as accepted from tracks t where t.lifecycle_status in ('draft','in_review') order by t.release_id,t.position`);
      return rows<AlbumTrackInput & { releaseId: string; position: number; accepted: boolean }>(
        result,
      );
    },
    async readiness(releaseId: string): Promise<AlbumReadiness[]> {
      const result = await db.execute(readinessQuery(releaseId));
      const tracks = rows<AlbumReadiness>(result);
      const parents = rows<{ ready: boolean }>(
        await db.execute(
          sql`select exists(select 1 from releases r where r.id=${releaseId}::uuid and r.lifecycle_status in ('draft','in_review','published') and nullif(btrim(r.title),'') is not null) and exists(select 1 from release_artist_credits c join artists a on a.id=c.artist_id where c.release_id=${releaseId}::uuid and c.position=1 and a.lifecycle_status in ('draft','in_review','published')) and not exists(select 1 from release_artist_credits c join artists a on a.id=c.artist_id where c.release_id=${releaseId}::uuid and a.lifecycle_status not in ('draft','in_review','published')) and exists(select 1 from release_artwork_assets l join artwork_assets a on a.id=l.artwork_asset_id where l.release_id=${releaseId}::uuid and l.role='primary' and a.status='ready' and a.scope='publishable_derivative') as ready`,
        ),
      );
      if (!parents[0]?.ready)
        tracks.unshift({
          id: releaseId,
          title: "Album",
          blockers: ["album title, eligible artist credits and ready public album cover"],
        });
      if (!tracks.length)
        tracks.push({ id: releaseId, title: "Album", blockers: ["at least one accepted track"] });
      return tracks;
    },
    async prepare(input: AlbumPreparation, actor: CuratorIdentity) {
      const ids = input.tracks.map((t) => t.id);
      if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
        throw new Error("Choose 1–100 distinct accepted tracks.");
      const json = JSON.stringify(input.tracks.map((t, index) => ({ ...t, position: index + 1 })));
      const selected = sql`select * from jsonb_to_recordset(${json}::jsonb) as x(id uuid,title text,genre text,moods text[],"processTags" text[],position integer)`;
      await db.batch([
        db.execute(lockCatalogue),
        db.execute(sql`select 1 / (exists(select 1 from artists where id=${input.artistId}::uuid and lifecycle_status in ('draft','in_review','published'))
          and not exists(select 1 from releases where id=${input.releaseId}::uuid and lifecycle_status not in ('draft','in_review'))
          and (select count(*) from tracks t join (${selected}) x on x.id=t.id where t.lifecycle_status in ('draft','in_review') and (${accepted})) = ${ids.length}
          and not exists(select 1 from tracks t where t.release_id=${input.releaseId}::uuid and t.id not in (select id from (${selected}) x)))::int as valid`),
        db.execute(
          sql`insert into releases(id,title,slug) values(${input.releaseId}::uuid,${input.title},${input.slug}) on conflict(id) do update set title=excluded.title,slug=excluded.slug`,
        ),
        db.execute(
          sql`insert into release_artist_credits(release_id,artist_id,position) values(${input.releaseId}::uuid,${input.artistId}::uuid,1) on conflict(release_id,position) do update set artist_id=excluded.artist_id`,
        ),
        db.execute(
          sql`update tracks t set position=t.position+1000000 from (${selected}) x where t.id=x.id`,
        ),
        db.execute(sql`with prior as materialized (select t.id,t.release_id,t.position-1000000 as position, (select artist_id from track_artist_credits where track_id=t.id and position=1) as artist_id from tracks t join (${selected}) x on x.id=t.id), changed as (update tracks t set release_id=${input.releaseId}::uuid, disc_number=1,position=x.position,title=x.title,genre=nullif(btrim(x.genre),''),moods=x.moods,creative_process_tags=x."processTags" from (${selected}) x where t.id=x.id returning t.id,t.lifecycle_status)
          insert into publication_audit(entity_type,entity_id,from_lifecycle,to_lifecycle,actor_id,actor_email,reason) select 'track',c.id,c.lifecycle_status,c.lifecycle_status,${actor.id},${actor.email},${"Album preparation: " + json} || ' Previous grouping: ' || jsonb_build_object('releaseId',p.release_id,'position',p.position,'primaryArtistId',p.artist_id,'destinationReleaseId',${input.releaseId}::uuid)::text from changed c join prior p on p.id=c.id`),
        db.execute(
          sql`insert into track_artist_credits(track_id,artist_id,position) select id,${input.artistId}::uuid,1 from (${selected}) x on conflict(track_id,position) do update set artist_id=excluded.artist_id`,
        ),
        db.execute(
          sql`insert into publication_audit(entity_type,entity_id,from_lifecycle,to_lifecycle,actor_id,actor_email,reason) select 'release',id,lifecycle_status,lifecycle_status,${actor.id},${actor.email},${"Album preparation: " + JSON.stringify({ artistId: input.artistId, trackIds: ids, title: input.title, slug: input.slug })} from releases where id=${input.releaseId}::uuid`,
        ),
      ]);
      return input.releaseId;
    },
    async applyCover(releaseId: string, actor: CuratorIdentity) {
      await db.batch([
        db.execute(lockCatalogue),
        db.execute(
          sql`select 1 / (exists(select 1 from releases where id=${releaseId}::uuid and lifecycle_status in ('draft','in_review')) and exists(select 1 from release_artwork_assets l join artwork_assets a on a.id=l.artwork_asset_id where l.release_id=${releaseId}::uuid and l.role='primary' and a.scope='publishable_derivative' and a.status='ready'))::int as valid`,
        ),
        db.execute(
          sql`insert into track_artwork_assets(track_id,artwork_asset_id,role,position,alt_text) select t.id,l.artwork_asset_id,'primary',1,l.alt_text from tracks t join release_artwork_assets l on l.release_id=t.release_id and l.role='primary' and l.position=1 where t.release_id=${releaseId}::uuid and t.lifecycle_status in ('draft','in_review') on conflict(track_id,role,position) do update set artwork_asset_id=excluded.artwork_asset_id,alt_text=excluded.alt_text`,
        ),
        db.execute(
          sql`insert into publication_audit(entity_type,entity_id,from_lifecycle,to_lifecycle,actor_id,actor_email,reason) select 'release',id,lifecycle_status,lifecycle_status,${actor.id},${actor.email},'Applied album cover to draft tracks' from releases where id=${releaseId}::uuid`,
        ),
      ]);
    },
    async publish(releaseId: string, actor: CuratorIdentity): Promise<string> {
      const result = await db.batch([
        db.execute(lockCatalogue),
        db.execute(sql`select 1 / (exists(select 1 from tracks where release_id=${releaseId}::uuid)
          and not exists(select 1 from (${readinessQuery(releaseId)}) readiness where cardinality(blockers)>0)
          and exists(select 1 from releases where id=${releaseId}::uuid and lifecycle_status in ('draft','in_review','published'))
          and exists(select 1 from release_artwork_assets l join artwork_assets a on a.id=l.artwork_asset_id where l.release_id=${releaseId}::uuid and l.role='primary' and a.scope='publishable_derivative' and a.status='ready')
          and exists(select 1 from release_artist_credits c where c.release_id=${releaseId}::uuid and c.position=1)
          and not exists(select 1 from release_artist_credits c join artists a on a.id=c.artist_id where c.release_id=${releaseId}::uuid and a.lifecycle_status not in ('draft','in_review','published')))::int as valid`),
        db.execute(sql`with artist_before as materialized (select a.id,a.lifecycle_status from artists a where a.id in (select artist_id from release_artist_credits where release_id=${releaseId}::uuid union select c.artist_id from track_artist_credits c join tracks t on t.id=c.track_id where t.release_id=${releaseId}::uuid) and a.lifecycle_status in ('draft','in_review')),
          release_before as materialized (select id,lifecycle_status from releases where id=${releaseId}::uuid and lifecycle_status in ('draft','in_review')),
          track_before as materialized (select id,lifecycle_status from tracks where release_id=${releaseId}::uuid and lifecycle_status in ('draft','in_review')),
          updated_artists as (update artists a set lifecycle_status='published',published_at=now(),scheduled_for=null from artist_before b where a.id=b.id returning a.id,b.lifecycle_status),
          updated_release as (update releases r set lifecycle_status='published',published_at=now(),scheduled_for=null from release_before b where r.id=b.id returning r.id,b.lifecycle_status),
          updated_tracks as (update tracks t set lifecycle_status='published',published_at=now(),scheduled_for=null from track_before b where t.id=b.id returning t.id,b.lifecycle_status)
          insert into publication_audit(entity_type,entity_id,from_lifecycle,to_lifecycle,actor_id,actor_email,reason)
          select kind,id,lifecycle_status,'published',${actor.id},${actor.email},${"Publish album " + releaseId} from (select 'artist' as kind,* from updated_artists union all select 'release',* from updated_release union all select 'track',* from updated_tracks) updates`),
        db.execute(
          sql`select slug from releases where id=${releaseId}::uuid and lifecycle_status='published'`,
        ),
      ]);
      return rows<{ slug: string }>(result[3])[0].slug;
    },
  };
}
