import { sql } from "drizzle-orm";
import { GENRES, MOODS, PROCESS_TAGS, validSelections } from "../config/music-metadata";
import { lockCatalogue } from "./album-publishing.server";
import type { Database } from "~/db/client.server";
import type { CuratorIdentity } from "~/types/curator";
import type { SubmissionEditorialFields } from "~/types/submission-edit";

function rows<T>(value: unknown): T[] {
  return (Array.isArray(value) ? value : (value as { rows: T[] }).rows) as T[];
}
export interface EditorialArtwork {
  id: string;
  objectKey: string;
  checksumSha256: string;
  byteSize: number;
  width: number;
  height: number;
  mimeType: string;
  filename: string;
}

// The artist record is never rewritten. Corrections are explicit curator notes;
// accepted catalogue presentation is updated in the same transaction as the note.
const fullEditAllowed = sql`(s.status not in ('rejected','withdrawn') and (s.resulting_release_id is null and s.resulting_track_id is null or (t.lifecycle_status in ('draft','in_review') and r.lifecycle_status in ('draft','in_review'))))`;

function editorQuery(id: string) {
  return sql`select s.id,s.public_reference as reference,s.status,s.artist_details->>'displayName' as "artistName",
    s.resulting_track_id as "trackId",r.id as "releaseId", (s.resulting_track_id is not null or r.id is null) as "releaseFieldsEditable",
    jsonb_build_object('title',coalesce(t.title,n.metadata->'fields'->>'title',s.title),
      'releaseTitle',coalesce(r.title,n.metadata->'fields'->>'releaseTitle',nullif(s.release_details->>'title',''),s.title),
      'summary',case when r.id is not null then coalesce(r.description,'') else coalesce(n.metadata->'fields'->>'summary',s.release_details->>'summary','') end,
      'genres',coalesce(to_jsonb(t.genres),n.metadata->'fields'->'genres',s.track_details->'genres','[]'::jsonb),
      'moods',coalesce(to_jsonb(t.moods),n.metadata->'fields'->'moods',s.track_details->'moods','[]'::jsonb),
      'processTags',coalesce(to_jsonb(t.creative_process_tags),n.metadata->'fields'->'processTags',s.track_details->'processTags','[]'::jsonb)) as fields,
    jsonb_build_object('submission',s.updated_at,'track',t.updated_at,'release',r.updated_at,'note',n.id,
      'curatorCover',ea.artwork_asset_id,'releaseCover',ra.artwork_asset_id,'trackCover',ta.artwork_asset_id,'artistCover',cs.cover_id) as revision,
    ${fullEditAllowed} as editable,
    (${fullEditAllowed} or (s.status='accepted' and t.id is not null and t.lifecycle_status in ('draft','in_review','published') and r.lifecycle_status in ('draft','in_review','published'))) as "discoveryEditable",
    coalesce(a.object_key,ac.object_key) as "coverObjectKey",coalesce(a.mime_type,ac.mime_type) as "coverMimeType",
    coalesce(a.id,ac.id) as "coverId"
    from submissions s left join tracks t on t.id=s.resulting_track_id left join submission_release_projects project on project.id::text=s.release_details->>'albumProjectId' left join releases r on r.id=coalesce(t.release_id,s.resulting_release_id,project.release_id)
    left join lateral(select id,metadata from submission_activities where submission_id=s.id and actor_role='curator' and metadata->>'kind'='curator_metadata' order by created_at desc,id desc limit 1) n on true
    left join lateral(select e.artwork_asset_id from submission_editorial_artwork e left join submissions member on member.id=e.submission_id left join tracks mt on mt.id=member.resulting_track_id where e.submission_id=s.id or mt.release_id=t.release_id order by e.updated_at desc,e.submission_id limit 1) ea on true
    left join release_artwork_assets ra on ra.release_id=t.release_id and ra.role='primary' and ra.position=1
    left join track_artwork_assets ta on ta.track_id=t.id and ta.role='primary' and ta.position=1
    left join artwork_assets a on a.id=coalesce(ea.artwork_asset_id,ra.artwork_asset_id,ta.artwork_asset_id) and a.status='ready'
    left join submission_cover_selections cs on cs.submission_id=s.id
    left join submission_cover_uploads ac on ac.id=cs.cover_id and ac.status='ready'
    where s.id=${id}::uuid`;
}
export interface SubmissionEditorRecord {
  id: string;
  reference: string;
  status: string;
  artistName: string;
  trackId: string | null;
  releaseId: string | null;
  fields: SubmissionEditorialFields;
  revision: unknown;
  editable: boolean;
  discoveryEditable: boolean;
  releaseFieldsEditable: boolean;
  coverObjectKey: string | null;
  coverMimeType: string | null;
  coverId: string | null;
}

export function createSubmissionEditRepository(db: Database) {
  return {
    async find(id: string) {
      return rows<SubmissionEditorRecord>(await db.execute(editorQuery(id)))[0] ?? null;
    },
    async overrides(ids: string[]) {
      if (!ids.length) return [];
      return rows<{ submissionId: string; fields: SubmissionEditorialFields }>(
        await db.execute(sql`
        select distinct on (submission_id) submission_id as "submissionId",metadata->'fields' as fields
        from submission_activities where submission_id in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid)
          and actor_role='curator' and metadata->>'kind'='curator_metadata' order by submission_id,created_at desc,id desc`),
      );
    },
    async save(
      id: string,
      revision: string,
      fields: SubmissionEditorialFields,
      reason: string,
      actor: CuratorIdentity,
      artwork?: EditorialArtwork,
    ) {
      const tasks = [
        db.execute(lockCatalogue),
        db.execute(
          sql`lock table submission_activities,submission_editorial_artwork,submission_cover_selections,submission_release_projects in share row exclusive mode`,
        ),
        db.execute(
          sql`select 1 / (exists(select 1 from (${editorQuery(id)}) current where
            (current.editable and (current."releaseFieldsEditable" or (current.fields->>'releaseTitle'=${fields.releaseTitle} and current.fields->>'summary'=${fields.summary}))
              or (current."discoveryEditable" and ${!artwork} and ${validSelections(fields.genres, GENRES) && validSelections(fields.moods, MOODS) && validSelections(fields.processTags, PROCESS_TAGS)}
                and current.fields->>'title'=${fields.title} and current.fields->>'releaseTitle'=${fields.releaseTitle} and current.fields->>'summary'=${fields.summary}))
            and current.revision=${revision}::jsonb))::int as valid`,
        ),
        db.execute(sql`insert into submission_activities(submission_id,activity_type,actor_role,actor_id,actor_email,message,metadata)
          select ${id}::uuid,'note','curator',${actor.id},${actor.email},${reason},
            jsonb_build_object('kind','curator_metadata','fields',${JSON.stringify(fields)}::jsonb,'previous',current.fields,'previousRevision',current.revision)
          from (${editorQuery(id)}) current`),
        db.execute(sql`update tracks t set genre=${fields.genres[0] ?? null},genres=array(select jsonb_array_elements_text(${JSON.stringify(fields.genres)}::jsonb)),moods=array(select jsonb_array_elements_text(${JSON.stringify(fields.moods)}::jsonb)),creative_process_tags=array(select jsonb_array_elements_text(${JSON.stringify(fields.processTags)}::jsonb)),updated_at=now()
          from submissions s where s.id=${id}::uuid and t.id=s.resulting_track_id`),
        // Restricted discovery corrections never write protected title/release fields,
        // including their timestamps and sibling confirmation revisions.
        db.execute(sql`update tracks t set title=${fields.title} from submissions s where s.id=${id}::uuid and t.id=s.resulting_track_id
          and exists(select 1 from (${editorQuery(id)}) current where current.editable)`),
        db.execute(sql`update releases r set title=${fields.releaseTitle},description=${fields.summary || null},updated_at=now()
          from submissions s join tracks t on t.id=s.resulting_track_id where s.id=${id}::uuid and r.id=t.release_id
            and exists(select 1 from (${editorQuery(id)}) current where current.editable)`),
        db.execute(sql`insert into publication_audit(entity_type,entity_id,from_lifecycle,to_lifecycle,actor_id,actor_email,reason)
          select 'track',t.id,t.lifecycle_status,t.lifecycle_status,${actor.id},${actor.email},${"Curator submission details: " + reason}
          from submissions s join tracks t on t.id=s.resulting_track_id where s.id=${id}::uuid`),
      ];
      if (artwork)
        tasks.push(
          db.execute(sql`insert into artwork_assets(id,object_key,storage_provider,status,scope,mime_type,checksum_sha256,byte_size,width,height)
          values(${artwork.id}::uuid,${artwork.objectKey},'r2','ready','publishable_derivative',${artwork.mimeType},${artwork.checksumSha256},${artwork.byteSize},${artwork.width},${artwork.height})`),
          // A release has one cover. An accepted album edit applies to all its
          // accepted submissions, without modifying any artist cover declaration.
          db.execute(sql`insert into submission_activities(submission_id,activity_type,actor_role,actor_id,actor_email,message,metadata)
          select s.id,'note','curator',${actor.id},${actor.email},${reason},jsonb_build_object('kind','curator_artwork','artworkId',${artwork.id}::text,
            'previousCuratorArtworkId',ea.artwork_asset_id,'filename',${artwork.filename}::text,'permissionConfirmed',true,'sourceSubmissionId',${id}::text)
          from submissions source join submissions s on s.id=source.id or (s.status='accepted' and s.resulting_track_id in (select member.id from tracks member join tracks selected on selected.id=source.resulting_track_id where member.release_id=selected.release_id))
          left join submission_editorial_artwork ea on ea.submission_id=s.id where source.id=${id}::uuid`),
          db.execute(sql`insert into submission_editorial_artwork(submission_id,artwork_asset_id)
          select s.id,${artwork.id}::uuid from submissions source join submissions s on s.id=source.id or (s.status='accepted' and s.resulting_track_id in (select member.id from tracks member join tracks selected on selected.id=source.resulting_track_id where member.release_id=selected.release_id))
          where source.id=${id}::uuid on conflict(submission_id) do update set artwork_asset_id=excluded.artwork_asset_id,updated_at=now()`),
        );
      tasks.push(db.execute(editorQuery(id)));
      const result = await db.batch(tasks as [(typeof tasks)[number], ...(typeof tasks)[number][]]);
      return rows<SubmissionEditorRecord>(result[result.length - 1])[0] ?? null;
    },
  };
}
