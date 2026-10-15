import { STREAMING_PROFILE } from "~/config/music-metadata";
import { sql, type SQL } from "drizzle-orm";
import type { Database } from "~/db/client.server";
import type { CuratorIdentity } from "~/types/curator";

export interface AlbumTrackInput {
  id: string;
  title: string;
  genre: string;
  genres?: string[];
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
export const lockCatalogue = sql`lock table artists, releases, tracks, release_artist_credits, track_artist_credits, release_artwork_assets, track_artwork_assets, audio_assets, artwork_assets, submissions, release_preparation_jobs, submission_cover_uploads in share row exclusive mode`;

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

// Resolve curator artwork separately from immutable artist cover declarations.
const effectiveCovers = sql`select t.id as track_id,coalesce(a.id,c.id) as id,
  coalesce(a.object_key,c.object_key) as object_key,coalesce(a.mime_type,c.mime_type) as mime_type,
  coalesce(a.checksum_sha256,c.checksum_sha256) as checksum_sha256,coalesce(a.byte_size,c.byte_size) as byte_size,
  coalesce(a.width,c.width) as width,coalesce(a.height,c.height) as height
  from tracks t left join submissions s on s.resulting_track_id=t.id
  left join release_preparation_jobs j on j.track_id=t.id
  left join lateral(select e.artwork_asset_id from submission_editorial_artwork e join submissions member on member.id=e.submission_id join tracks mt on mt.id=member.resulting_track_id where mt.release_id=t.release_id order by e.updated_at desc,e.submission_id limit 1) ea on true
  left join release_artwork_assets ra on ra.release_id=t.release_id and ra.role='primary' and ra.position=1
  left join track_artwork_assets ta on ta.track_id=t.id and ta.role='primary' and ta.position=1
  left join artwork_assets a on a.id=coalesce(ea.artwork_asset_id,ra.artwork_asset_id,ta.artwork_asset_id) and a.status='ready' and a.scope='publishable_derivative'
  left join submission_cover_selections sc on sc.submission_id=s.id
  left join submission_cover_uploads c on c.id=coalesce(j.cover_id,sc.cover_id) and c.status='ready'
  where a.id is not null or c.id is not null`;

function readinessQuery(releaseId: string): SQL {
  return sql`select t.id, t.title, array_remove(array[
    case when not (${accepted}) then 'accepted A/B review with exact pinned declarations and private audio' end,
    case when exists(select 1 from release_preparation_jobs j where j.track_id=t.id and (j.status<>'ready' or j.profile<>${STREAMING_PROFILE})) then 'verified automatic streaming preparation' when not exists(select 1 from release_preparation_jobs j where j.track_id=t.id and j.status='ready') and not exists(select 1 from audio_assets a where a.track_id=t.id and a.scope='publishable_derivative' and a.status='ready' and a.is_primary and a.duration_ms > 0) then 'ready primary public listening file' end,
    case when not exists(select 1 from (${effectiveCovers}) c where c.track_id=t.id) then 'ready primary track cover (add artwork in Edit details)' end,
    case when nullif(btrim(t.genre),'') is null or cardinality(t.moods)=0 or cardinality(t.creative_process_tags)=0 then 'genre, moods and creative process tags' end,
    case when t.lifecycle_status not in ('draft','in_review','published') then 'track must be draft or in review' end,
    case when not exists(select 1 from track_artist_credits c where c.track_id=t.id and c.position=1) or exists(select 1 from track_artist_credits c join artists a on a.id=c.artist_id where c.track_id=t.id and a.lifecycle_status not in ('draft','in_review','published')) then 'eligible credited artists' end
  ], null)::text[] as blockers from tracks t where t.release_id=${releaseId}::uuid order by t.disc_number,t.position,t.id`;
}

function publicationRevisionQuery(releaseId: string) {
  return sql`select jsonb_build_object('release',r.updated_at,'artists',(
    select jsonb_agg(jsonb_build_object('credit',to_jsonb(c),'updated',a.updated_at) order by c.position,c.artist_id)
    from release_artist_credits c join artists a on a.id=c.artist_id where c.release_id=r.id), 'trackCredits',(
    select jsonb_agg(jsonb_build_object('credit',to_jsonb(c),'updated',a.updated_at) order by c.track_id,c.position,c.artist_id)
    from track_artist_credits c join artists a on a.id=c.artist_id join tracks member on member.id=c.track_id where member.release_id=r.id), 'tracks',(
    select jsonb_agg(jsonb_build_object('id',t.id,'updated',t.updated_at,'cover',c.id,'coverChecksum',c.checksum_sha256) order by t.disc_number,t.position,t.id)
    from tracks t left join (${effectiveCovers}) c on c.track_id=t.id where t.release_id=r.id)) as revision
    from releases r where r.id=${releaseId}::uuid`;
}

export function createAlbumPublishingRepository(db: Database) {
  return {
    async publicationRevision(releaseId: string) {
      return JSON.stringify(
        rows<{ revision: unknown }>(await db.execute(publicationRevisionQuery(releaseId)))[0]
          ?.revision ?? null,
      );
    },
    async releaseForAcceptedTrack(id: string) {
      return (
        rows<{ releaseId: string }>(
          await db.execute(
            sql`select t.release_id as "releaseId" from tracks t where t.id=${id}::uuid and (${accepted})`,
          ),
        )[0]?.releaseId ?? null
      );
    },
    async inventory() {
      const result =
        await db.execute(sql`select t.id, t.title, t.release_id as "releaseId", coalesce(t.genre,'') as genre, t.genres, t.moods, t.creative_process_tags as "processTags", t.position,
        (${accepted}) as accepted,
        (select j.status from release_preparation_jobs j where j.track_id=t.id) as "preparationStatus",
        (select c.id from (${effectiveCovers}) c where c.track_id=t.id) as "coverId",
        (select s.id from submissions s where s.resulting_track_id=t.id) as "submissionId",
        (select j.failure_code from release_preparation_jobs j where j.track_id=t.id) as "failureCode",
        (select s.release_details->>'kind' from submissions s where s.resulting_track_id=t.id) as "releaseKind",
        (select c.artist_id from track_artist_credits c where c.track_id=t.id and c.position=1) as "artistId",
        (select a.display_name from track_artist_credits c join artists a on a.id=c.artist_id where c.track_id=t.id and c.position=1) as "artistName",
        (exists(select 1 from release_preparation_jobs j where j.track_id=t.id and j.status='ready') or exists(select 1 from audio_assets a where a.track_id=t.id and a.is_primary and a.scope='publishable_derivative' and a.status='ready')) as "publicAudioReady" from tracks t where t.lifecycle_status in ('draft','in_review') order by t.release_id,t.position`);
      return rows<
        AlbumTrackInput & {
          releaseId: string;
          position: number;
          accepted: boolean;
          artistId: string | null;
          artistName: string | null;
          publicAudioReady: boolean;
          preparationStatus: string | null;
          coverId: string | null;
          submissionId: string | null;
          failureCode: string | null;
          releaseKind: string | null;
        }
      >(result);
    },
    async readiness(releaseId: string): Promise<AlbumReadiness[]> {
      const result = await db.execute(readinessQuery(releaseId));
      const tracks = rows<AlbumReadiness>(result);
      const [parent] = rows<{ titleReady: boolean; artistReady: boolean; coverReady: boolean }>(
        await db.execute(sql`
        select exists(select 1 from releases r where r.id=${releaseId}::uuid and r.lifecycle_status in ('draft','in_review','published') and nullif(btrim(r.title),'') is not null) as "titleReady",
        (exists(select 1 from release_artist_credits c where c.release_id=${releaseId}::uuid and c.position=1) and not exists(select 1 from release_artist_credits c join artists a on a.id=c.artist_id where c.release_id=${releaseId}::uuid and a.lifecycle_status not in ('draft','in_review','published'))) as "artistReady",
        exists(select 1 from tracks t join (${effectiveCovers}) c on c.track_id=t.id where t.release_id=${releaseId}::uuid) as "coverReady"
      `),
      );
      const blockers = [];
      if (!parent?.titleReady) blockers.push("saved album title and eligible release");
      if (!parent?.artistReady) blockers.push("primary artist and eligible artist credits");
      if (!parent?.coverReady) blockers.push("ready public album cover");
      if (!tracks.length) blockers.push("at least one accepted track");
      if (blockers.length) tracks.unshift({ id: releaseId, title: "Album", blockers });
      const issues = rows<{ pending: number; coverVariants: number; orderReady: boolean }>(
        await db.execute(sql`
        select (select count(*)::int from submissions s join submission_release_projects p on p.id::text=s.release_details->>'albumProjectId'
          where p.release_id=${releaseId}::uuid and s.status not in ('accepted','rejected','withdrawn')) as pending,
        (select count(distinct c.checksum_sha256)::int from tracks t join (${effectiveCovers}) c on c.track_id=t.id where t.release_id=${releaseId}::uuid) as "coverVariants",
        (select coalesce(min(t.position)=1 and max(t.position)=count(*),false) from tracks t where t.release_id=${releaseId}::uuid) as "orderReady"`),
      )[0];
      if (issues?.pending)
        tracks.unshift({
          id: releaseId,
          title: "Album",
          blockers: ["album tracks still awaiting curation"],
        });
      if (issues?.coverVariants > 1)
        tracks.unshift({
          id: releaseId,
          title: "Album",
          blockers: ["one consistent album cover (replace artwork in Edit details)"],
        });
      if (!issues?.orderReady)
        tracks.unshift({
          id: releaseId,
          title: "Album",
          blockers: ["complete consecutive track order starting at 1"],
        });
      return tracks;
    },
    async reorder(releaseId: string, ids: string[], expectedIds: string[], actor: CuratorIdentity) {
      if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
        throw new Error("Choose every accepted track once.");
      const json = JSON.stringify(ids.map((id, index) => ({ id, position: index + 1 })));
      const selected = sql`select * from jsonb_to_recordset(${json}::jsonb) as x(id uuid,position integer)`;
      await db.batch([
        db.execute(lockCatalogue),
        db.execute(sql`select 1 / (
          exists(select 1 from releases where id=${releaseId}::uuid and lifecycle_status in ('draft','in_review'))
          and (select jsonb_agg(t.id::text order by t.disc_number,t.position,t.id) from tracks t where t.release_id=${releaseId}::uuid)=${JSON.stringify(expectedIds)}::jsonb
          and (select count(*) from tracks t where t.release_id=${releaseId}::uuid)=${ids.length}
          and (select count(*) from tracks t join (${selected}) x on x.id=t.id where t.release_id=${releaseId}::uuid and t.lifecycle_status in ('draft','in_review') and (${accepted}))=${ids.length}
        )::int as valid`),
        db.execute(
          sql`update tracks set position=position+1000000 where release_id=${releaseId}::uuid`,
        ),
        db.execute(sql`with prior as materialized (select id,position-1000000 as position from tracks where release_id=${releaseId}::uuid), changed as (
          update tracks t set position=x.position,disc_number=1 from (${selected}) x where t.id=x.id returning t.id,t.lifecycle_status,t.position
        ) insert into publication_audit(entity_type,entity_id,from_lifecycle,to_lifecycle,actor_id,actor_email,reason)
          select 'track',c.id,c.lifecycle_status,c.lifecycle_status,${actor.id},${actor.email},'Curator album order: '||jsonb_build_object('releaseId',${releaseId}::uuid,'previousPosition',p.position,'position',c.position)::text
          from changed c join prior p on p.id=c.id where p.position<>c.position`),
      ]);
    },
    async prepare(input: AlbumPreparation, actor: CuratorIdentity) {
      const ids = input.tracks.map((t) => t.id);
      if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
        throw new Error("Choose 1–100 distinct accepted tracks.");
      const json = JSON.stringify(input.tracks.map((t, index) => ({ ...t, position: index + 1 })));
      const selected = sql`select * from jsonb_to_recordset(${json}::jsonb) as x(id uuid,title text,genre text,genres text[],moods text[],"processTags" text[],position integer)`;
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
          sql`delete from release_artist_credits where release_id=${input.releaseId}::uuid and artist_id=${input.artistId}::uuid and position<>1`,
        ),
        db.execute(
          sql`insert into release_artist_credits(release_id,artist_id,position) values(${input.releaseId}::uuid,${input.artistId}::uuid,1) on conflict(release_id,position) do update set artist_id=excluded.artist_id,credited_as=case when release_artist_credits.artist_id=excluded.artist_id then release_artist_credits.credited_as else null end`,
        ),
        db.execute(
          sql`update tracks t set position=t.position+1000000 from (${selected}) x where t.id=x.id`,
        ),
        db.execute(sql`with prior as materialized (select t.id,t.slug,t.release_id,t.position-1000000 as position, (select artist_id from track_artist_credits where track_id=t.id and position=1) as artist_id from tracks t join (${selected}) x on x.id=t.id), collisions as (select count(*)<>count(distinct slug) as present from prior), changed as (update tracks t set release_id=${input.releaseId}::uuid, slug=case when collisions.present and right(t.slug,37)<>'-' || t.id::text then t.slug || '-' || t.id::text else t.slug end, disc_number=1,position=x.position,title=x.title,genre=nullif(btrim(x.genre),''),genres=coalesce(x.genres,case when nullif(btrim(x.genre),'') is not null then array[x.genre] else '{}'::text[] end),moods=x.moods,creative_process_tags=x."processTags" from (${selected}) x, collisions where t.id=x.id returning t.id,t.lifecycle_status)
          insert into publication_audit(entity_type,entity_id,from_lifecycle,to_lifecycle,actor_id,actor_email,reason) select 'track',c.id,c.lifecycle_status,c.lifecycle_status,${actor.id},${actor.email},${"Album preparation: " + json} || ' Previous grouping: ' || jsonb_build_object('releaseId',p.release_id,'position',p.position,'slug',p.slug,'primaryArtistId',p.artist_id,'destinationReleaseId',${input.releaseId}::uuid)::text from changed c join prior p on p.id=c.id`),
        db.execute(
          sql`delete from track_artist_credits where track_id in (select id from (${selected}) x) and artist_id=${input.artistId}::uuid and position<>1`,
        ),
        db.execute(
          sql`insert into track_artist_credits(track_id,artist_id,position) select id,${input.artistId}::uuid,1 from (${selected}) x on conflict(track_id,position) do update set artist_id=excluded.artist_id,credited_as=case when track_artist_credits.artist_id=excluded.artist_id then track_artist_credits.credited_as else null end`,
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
    async publish(
      releaseId: string,
      actor: CuratorIdentity,
      expectedTrackIds?: string[],
      expectedRevision?: string,
    ): Promise<string> {
      const result = await db.batch([
        db.execute(lockCatalogue),
        db.execute(
          sql`select 1 / (${expectedRevision ? sql`(exists(select 1 from releases where id=${releaseId}::uuid and lifecycle_status='published') or exists(select 1 from (${publicationRevisionQuery(releaseId)}) current where current.revision=${expectedRevision}::jsonb))` : sql`true`})::int as confirmed_revision`,
        ),
        db.execute(
          sql`select 1 / (${expectedTrackIds ? sql`(select jsonb_agg(t.id::text order by t.disc_number,t.position,t.id) from tracks t where t.release_id=${releaseId}::uuid)=${JSON.stringify(expectedTrackIds)}::jsonb` : sql`true`})::int as confirmed_tracks`,
        ),
        db.execute(sql`select 1 / (
          not exists(select 1 from tracks t join release_preparation_jobs j on j.track_id=t.id where t.release_id=${releaseId}::uuid and (j.status<>'ready' or j.profile<>${STREAMING_PROFILE}))
          and not exists(select 1 from submissions s join submission_release_projects p on p.id::text=s.release_details->>'albumProjectId' where p.release_id=${releaseId}::uuid and s.status not in ('accepted','rejected','withdrawn'))
          and (select count(distinct c.checksum_sha256)<=1 from tracks t join (${effectiveCovers}) c on c.track_id=t.id where t.release_id=${releaseId}::uuid)
          and (select coalesce(min(t.position)=1 and max(t.position)=count(*),false) from tracks t where t.release_id=${releaseId}::uuid)
        )::int as prepared`),
        db.execute(sql`insert into audio_assets(id,track_id,object_key,storage_provider,status,scope,mime_type,checksum_sha256,byte_size,duration_ms,codec,is_primary)
          select j.id,t.id,j.output_object_key,'r2','ready','publishable_derivative','audio/mpeg',j.output_checksum,j.output_byte_size,j.output_duration_ms,'mp3',true
          from tracks t join release_preparation_jobs j on j.track_id=t.id where t.release_id=${releaseId}::uuid and j.status='ready' and t.lifecycle_status<>'published'
          on conflict(track_id,scope) where is_primary do update set object_key=excluded.object_key,storage_provider='r2',status='ready',mime_type=excluded.mime_type,checksum_sha256=excluded.checksum_sha256,byte_size=excluded.byte_size,duration_ms=excluded.duration_ms,codec=excluded.codec`),
        db.execute(sql`insert into artwork_assets(id,object_key,storage_provider,status,scope,mime_type,checksum_sha256,byte_size,width,height)
          select distinct c.id,c.object_key,'r2'::storage_provider,'ready'::managed_asset_status,'publishable_derivative'::asset_scope,c.mime_type,c.checksum_sha256,c.byte_size,c.width,c.height
          from tracks t join (${effectiveCovers}) c on c.track_id=t.id
          where t.release_id=${releaseId}::uuid and t.lifecycle_status<>'published' on conflict(id) do nothing`),
        db.execute(sql`insert into release_artwork_assets(release_id,artwork_asset_id,role,position)
          select ${releaseId}::uuid,c.id,'primary',1 from tracks t join (${effectiveCovers}) c on c.track_id=t.id
          where t.release_id=${releaseId}::uuid and t.lifecycle_status<>'published' order by t.position limit 1
          on conflict(release_id,role,position) do update set artwork_asset_id=excluded.artwork_asset_id`),
        db.execute(sql`insert into track_artwork_assets(track_id,artwork_asset_id,role,position)
          select t.id,c.artwork_asset_id,'primary',1 from tracks t join release_artwork_assets c on c.release_id=t.release_id and c.role='primary' and c.position=1
          where t.release_id=${releaseId}::uuid and t.lifecycle_status<>'published'
          on conflict(track_id,role,position) do update set artwork_asset_id=excluded.artwork_asset_id`),
        db.execute(sql`select 1 / (exists(select 1 from tracks where release_id=${releaseId}::uuid)
          and not exists(select 1 from (${readinessQuery(releaseId)}) readiness where cardinality(blockers)>0)
          and exists(select 1 from releases where id=${releaseId}::uuid and lifecycle_status in ('draft','in_review','published'))
          and exists(select 1 from release_artwork_assets l join artwork_assets a on a.id=l.artwork_asset_id where l.release_id=${releaseId}::uuid and l.role='primary' and a.scope='publishable_derivative' and a.status='ready')
          and exists(select 1 from release_artist_credits c where c.release_id=${releaseId}::uuid and c.position=1)
          and not exists(select 1 from release_artist_credits c join artists a on a.id=c.artist_id where c.release_id=${releaseId}::uuid and a.lifecycle_status not in ('draft','in_review','published')))::int as valid`),
        db.execute(sql`select set_config('sunsyn.atomic_publish_release',${releaseId},true)`),
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
      return rows<{ slug: string }>(result[result.length - 1])[0].slug;
    },
  };
}
