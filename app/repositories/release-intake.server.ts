import { sql } from "drizzle-orm";
import { COVER_RIGHTS_STATEMENT } from "~/config/music-metadata";
import type { Database } from "~/db/client.server";
import type { SubmissionDraftInput } from "./submissions.server";

function rows<T>(value: unknown): T[] {
  return (Array.isArray(value) ? value : (value as { rows: T[] }).rows) as T[];
}
export interface SubmissionCover {
  id: string;
  submissionId: string;
  filename: string;
  mimeType: string;
  checksumSha256: string;
  byteSize: number;
  width: number;
  height: number;
  stagingObjectKey: string;
  objectKey: string | null;
  status: string;
  expiresAt: Date | string;
  leaseToken: string | null;
  canReplace?: boolean;
}
const coverColumns = sql`c.id,c.submission_id as "submissionId",c.filename,c.mime_type as "mimeType",c.checksum_sha256 as "checksumSha256",c.byte_size::float8 as "byteSize",c.width,c.height,c.staging_object_key as "stagingObjectKey",c.object_key as "objectKey",c.status,c.expires_at as "expiresAt",c.lease_token as "leaseToken"`;

// Cover-only recovery never changes an accepted audio version or declaration.
const editableCover = sql`(s.status in ('draft','clarification_requested') or (s.status='accepted'
  and not exists(select 1 from submission_cover_selections sc where sc.submission_id=s.id)
  and exists(select 1 from tracks t where t.id=s.resulting_track_id and t.lifecycle_status in ('draft','in_review'))))`;

export function createReleaseIntakeRepository(db: Database) {
  return {
    async albumsForInvitation(tokenHash: string) {
      return rows<{ id: string; title: string; artistName: string; nextTrackNumber: number }>(
        await db.execute(sql`
        select p.id,p.title,p.artist_name as "artistName",
        (select coalesce(max((other.release_details->>'trackNumber')::int),0)+1 from submissions other
          where other.release_details->>'albumProjectId'=p.id::text and other.status not in ('rejected','withdrawn')) as "nextTrackNumber"
        from submission_release_projects p
        join submission_invitations i on lower(i.invitee_email)=p.owner_email
        left join releases r on r.id=p.release_id
        where i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now()
          and (r.id is null or r.lifecycle_status in ('draft','in_review')) order by p.created_at,p.id`),
      );
    },
    async saveAlbumChoice(tokenHash: string, input: SubmissionDraftInput) {
      const album = input.release.kind === "album";
      const projectId = input.release.albumProjectId || null;
      if (!album) return;
      const newId = crypto.randomUUID();
      await db.batch([
        db.execute(sql`select 1 / exists(select 1 from submissions s join submission_invitations i on i.id=s.invitation_id
          where i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now() and s.status in ('draft','clarification_requested'))::int`),
        ...(projectId
          ? []
          : [
              db.execute(sql`insert into submission_release_projects(id,owner_email,artist_name,title,origin_submission_id)
          select ${newId}::uuid,lower(i.invitee_email),${input.artist.displayName},${input.release.title},s.id
          from submissions s join submission_invitations i on i.id=s.invitation_id where i.token_hash=${tokenHash}
          on conflict(origin_submission_id) do update set artist_name=excluded.artist_name,title=excluded.title
          where not exists(select 1 from releases where id=submission_release_projects.release_id)
            and not exists(select 1 from submissions other where other.release_details->>'albumProjectId'=submission_release_projects.id::text and other.id<>submission_release_projects.origin_submission_id)`),
            ]),
        db.execute(sql`with eligible as (
          select s.id,p.id as project_id,p.title from submissions s join submission_invitations i on i.id=s.invitation_id
          join submission_release_projects p on p.owner_email=lower(i.invitee_email)
            and (${projectId}::uuid is not null and p.id=${projectId}::uuid or ${projectId}::uuid is null and p.origin_submission_id=s.id)
          left join releases r on r.id=p.release_id
          where i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now()
            and s.status in ('draft','clarification_requested')
            and lower(p.artist_name)=lower(${input.artist.displayName})
            and (r.id is null or r.lifecycle_status in ('draft','in_review'))
            and not exists(select 1 from submissions other where other.id<>s.id and other.release_details->>'albumProjectId'=p.id::text
              and other.status not in ('rejected','withdrawn') and other.release_details->>'trackNumber'=${String(input.release.trackNumber)})
          for update of s
        ), saved as (update submissions s set release_details=s.release_details || jsonb_build_object('albumProjectId',e.project_id,'title',e.title)
          from eligible e where s.id=e.id returning s.id)
        select 1 / exists(select 1 from saved)::int as valid`),
      ]);
    },
    async validateAlbumChoice(tokenHash: string) {
      return (
        rows<{ valid: boolean }>(
          await db.execute(sql`select exists(
        select 1 from submissions s join submission_invitations i on i.id=s.invitation_id
        join submission_release_projects p on p.id::text=s.release_details->>'albumProjectId' and p.owner_email=lower(i.invitee_email)
        left join releases r on r.id=p.release_id
        where i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now()
          and lower(p.artist_name)=lower(s.artist_details->>'displayName') and (r.id is null or r.lifecycle_status in ('draft','in_review'))
          and not exists(select 1 from submissions other where other.id<>s.id and other.release_details->>'albumProjectId'=p.id::text
            and other.status not in ('rejected','withdrawn') and other.release_details->>'trackNumber'=s.release_details->>'trackNumber')
      ) as valid`),
        )[0]?.valid ?? false
      );
    },
    async reuseAlbumCover(tokenHash: string) {
      await db.execute(sql`insert into submission_cover_selections(submission_id,cover_id)
        select s.id,c.id from submissions s join submission_invitations i on i.id=s.invitation_id
        join submissions other on nullif(other.release_details->>'albumProjectId','')=nullif(s.release_details->>'albumProjectId','') and other.id<>s.id
        join submission_cover_selections sc on sc.submission_id=other.id join submission_cover_uploads c on c.id=sc.cover_id
        where i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now()
          and s.status in ('draft','clarification_requested') and c.status='ready' and submission_may_use_cover(s.id,c.id)
        order by c.created_at,c.id limit 1 on conflict(submission_id) do nothing`);
    },
    async currentCover(tokenHash: string) {
      const result = await db.execute(sql`select ${coverColumns},
        (s.status in ('draft','clarification_requested') and (coalesce(s.release_details->>'kind','single')<>'album' or (
          c.submission_id=s.id and not exists(select 1 from submissions other join submission_cover_selections sc on sc.submission_id=other.id
            where other.id<>s.id and nullif(other.release_details->>'albumProjectId','')=nullif(s.release_details->>'albumProjectId',''))))) as "canReplace"
        from submission_cover_uploads c
        join submission_cover_selections selected on selected.cover_id=c.id
        join submissions s on s.id=selected.submission_id join submission_invitations i on i.id=s.invitation_id
        where i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now() and c.status='ready' and submission_may_use_cover(s.id,c.id)`);
      return rows<SubmissionCover>(result)[0] ?? null;
    },
    async findCover(id: string, tokenHash?: string) {
      return (
        rows<SubmissionCover>(
          await db.execute(sql`select ${coverColumns} from submission_cover_uploads c
        where c.id=${id}::uuid and c.status='ready'
          ${
            tokenHash
              ? sql`and exists(select 1 from submissions s join submission_invitations i on i.id=s.invitation_id
            where i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now()
              and (s.id=c.submission_id or exists(select 1 from submission_cover_selections sc where sc.submission_id=s.id and sc.cover_id=c.id)))`
              : sql``
          }`),
        )[0] ?? null
      );
    },
    async createCover(
      tokenHash: string,
      input: Omit<SubmissionCover, "submissionId" | "status" | "objectKey" | "leaseToken">,
    ) {
      return (
        rows<SubmissionCover>(
          await db.execute(sql`with created as (
        insert into submission_cover_uploads(id,submission_id,filename,mime_type,checksum_sha256,byte_size,width,height,staging_object_key,expires_at,rights_statement,rights_acknowledged_at)
        select ${input.id}::uuid,s.id,${input.filename},${input.mimeType},${input.checksumSha256},${input.byteSize},${input.width},${input.height},${input.stagingObjectKey},${new Date(input.expiresAt).toISOString()}::timestamptz,${COVER_RIGHTS_STATEMENT},now()
        from submissions s join submission_invitations i on i.id=s.invitation_id
        where i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now() and ${editableCover} and not exists(select 1 from submissions other join submission_cover_selections sc on sc.submission_id=other.id
          where s.release_details->>'kind'='album' and other.id<>s.id and nullif(other.release_details->>'albumProjectId','')=nullif(s.release_details->>'albumProjectId','')) returning *
      ) select ${coverColumns} from created c`),
        )[0] ?? null
      );
    },
    async claimCover(tokenHash: string, id: string, lease: string) {
      return (
        rows<SubmissionCover>(
          await db.execute(sql`with eligible as (
        select c.id from submission_cover_uploads c join submissions s on s.id=c.submission_id join submission_invitations i on i.id=s.invitation_id
        where c.id=${id}::uuid and i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now()
          and ${editableCover} and not exists(select 1 from submissions other join submission_cover_selections sc on sc.submission_id=other.id
            where s.release_details->>'kind'='album' and other.id<>s.id and nullif(other.release_details->>'albumProjectId','')=nullif(s.release_details->>'albumProjectId','')) and c.expires_at>now()
          and (c.status='pending' or c.status='finalizing' and c.lease_expires_at<now()) for update of c,s
      ), claimed as (update submission_cover_uploads c set status='finalizing',lease_token=${lease}::uuid,lease_expires_at=now()+interval '2 minutes'
        from eligible e where c.id=e.id returning c.*) select ${coverColumns} from claimed c`),
        )[0] ?? null
      );
    },
    async completeCover(tokenHash: string, id: string, lease: string, key: string) {
      return (
        rows<{ id: string }>(
          await db.execute(sql`with eligible as (
        select c.id,c.submission_id from submission_cover_uploads c join submissions s on s.id=c.submission_id join submission_invitations i on i.id=s.invitation_id
        where c.id=${id}::uuid and c.lease_token=${lease}::uuid and c.status='finalizing' and c.lease_expires_at>now()
          and i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now() and ${editableCover} and not exists(select 1 from submissions other join submission_cover_selections sc on sc.submission_id=other.id
            where s.release_details->>'kind'='album' and other.id<>s.id and nullif(other.release_details->>'albumProjectId','')=nullif(s.release_details->>'albumProjectId','')) for update of s,c
      ), sealed as (update submission_cover_uploads c set status='ready',object_key=${key},finalized_at=now(),lease_token=null,lease_expires_at=null
        from eligible e where c.id=e.id returning c.id,c.submission_id), selected as (
        insert into submission_cover_selections(submission_id,cover_id) select submission_id,id from sealed
        on conflict(submission_id) do update set cover_id=excluded.cover_id returning cover_id
      ), attached as (
        update release_preparation_jobs j set cover_id=chosen.cover_id,updated_at=now()
        from selected chosen,curation_reviews r where j.review_id=r.id and r.submission_id in (select submission_id from eligible)
          and j.cover_id is null and j.status in ('queued','failed') returning j.track_id
      ), audited as (
        insert into publication_audit(entity_type,entity_id,from_lifecycle,to_lifecycle,actor_id,actor_email,reason)
        select 'track',t.id,t.lifecycle_status,t.lifecycle_status,'submitter:'||s.id,i.invitee_email,'Artist supplied missing cover through invitation; accepted review unchanged'
        from attached a join tracks t on t.id=a.track_id join submissions s on s.resulting_track_id=t.id join submission_invitations i on i.id=s.invitation_id
      ) select cover_id as id from selected`),
        )[0] ?? null
      );
    },
    async releaseCover(id: string, lease: string) {
      await db.execute(
        sql`update submission_cover_uploads set status='pending',lease_token=null,lease_expires_at=null where id=${id}::uuid and lease_token=${lease}::uuid and status='finalizing'`,
      );
    },
  };
}
