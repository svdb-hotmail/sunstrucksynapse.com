import { sql } from "drizzle-orm";
import { COVER_RIGHTS_STATEMENT } from "~/config/music-metadata";
import type { Database } from "~/db/client.server";

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
      ), cleanup as (
        insert into curation_outbox(idempotency_key,kind,payload,available_at)
        select 'cover-upload:'||id||':staging-cleanup','cover_staging_cleanup',jsonb_build_object('uploadSessionId',id),expires_at from created
        on conflict(idempotency_key) do nothing returning id
      ) select ${coverColumns} from created c,cleanup`),
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
      const result = await db.batch([
        db.execute(sql`select p.id from submission_release_projects p join submissions s on p.id::text=s.release_details->>'albumProjectId'
          join submission_invitations i on i.id=s.invitation_id join submission_cover_uploads c on c.submission_id=s.id
          where c.id=${id}::uuid and i.token_hash=${tokenHash} and c.lease_token=${lease}::uuid for update of p`),
        db.execute(sql`with eligible as (
          select c.id,c.submission_id from submission_cover_uploads c join submissions s on s.id=c.submission_id join submission_invitations i on i.id=s.invitation_id
          where c.id=${id}::uuid and c.lease_token=${lease}::uuid and c.status='finalizing' and c.lease_expires_at>now()
            and i.token_hash=${tokenHash} and i.revoked_at is null and i.expires_at>now() and ${editableCover} for update of s,c
        ), winner as (
          select e.submission_id,e.id as uploaded_id,coalesce((select sc.cover_id from submissions s join submissions other
            on nullif(other.release_details->>'albumProjectId','')=nullif(s.release_details->>'albumProjectId','') and other.id<>s.id
            join submission_cover_selections sc on sc.submission_id=other.id join submission_cover_uploads c on c.id=sc.cover_id
            where s.id=e.submission_id and s.release_details->>'kind'='album' and c.status='ready' and submission_may_use_cover(s.id,c.id)
            order by c.created_at,c.id limit 1),e.id) as cover_id from eligible e
        ), sealed as (
          update submission_cover_uploads c set status='ready',object_key=${key},finalized_at=now(),lease_token=null,lease_expires_at=null
          from winner w where c.id=w.uploaded_id and w.cover_id=c.id returning c.id
        ), superseded as (
          update submission_cover_uploads c set status='failed',lease_token=null,lease_expires_at=null
          from winner w where c.id=w.uploaded_id and w.cover_id<>c.id returning c.id
        ), selected as (
          insert into submission_cover_selections(submission_id,cover_id) select w.submission_id,w.cover_id from winner w
          where exists(select 1 from sealed where id=w.uploaded_id) or exists(select 1 from superseded where id=w.uploaded_id)
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
      ]);
      return rows<{ id: string }>(result[1])[0] ?? null;
    },
    async releaseCover(id: string, lease: string) {
      await db.execute(
        sql`update submission_cover_uploads set status='pending',lease_token=null,lease_expires_at=null where id=${id}::uuid and lease_token=${lease}::uuid and status='finalizing'`,
      );
    },
    async coverStagingCleanupTarget(id: string, now: Date) {
      const [cover] = rows<SubmissionCover>(
        await db.execute(
          sql`select ${coverColumns} from submission_cover_uploads c where c.id=${id}::uuid`,
        ),
      );
      if (!cover) return { status: "missing" } as const;
      if (new Date(cover.expiresAt) > now) return { status: "defer" } as const;
      const busy = rows<{ busy: boolean }>(
        await db.execute(
          sql`select exists(select 1 from submission_cover_uploads where id=${id}::uuid and status='finalizing' and lease_expires_at>${now.toISOString()}::timestamptz) as busy`,
        ),
      )[0]?.busy;
      if (busy) return { status: "defer" } as const;
      // Derive the exact staging key from the validated session ID. Never clean
      // selected covers or any prefix supplied by an outbox payload.
      if (cover.stagingObjectKey !== `private/submission-covers/staging/${id}`)
        throw new Error("Invalid staging key");
      return { status: "ready", stagingObjectKey: cover.stagingObjectKey } as const;
    },
  };
}
