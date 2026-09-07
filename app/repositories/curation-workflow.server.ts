import { sql, type SQL } from "drizzle-orm";

import type { Database } from "~/db/client.server";
import type { CuratorIdentity } from "~/types/curator";

export const REVIEW_AUDIO_MAX_BYTES = 500 * 1024 * 1024;
export const REVIEW_AUDIO_UPLOAD_TTL_MS = 15 * 60 * 1000;
export const REVIEW_AUDIO_FINALIZE_LEASE_MS = 2 * 60 * 1000;

export const REVIEW_AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
]);

export interface ReviewAudioDeclaration {
  filename: string;
  mimeType: string;
  checksumSha256: string;
  byteSize: number;
  durationMs: number;
  codec: string;
}

export interface ReviewAudioUploadSession extends ReviewAudioDeclaration {
  id: string;
  submissionId: string;
  stagingObjectKey: string;
  status: "pending" | "finalizing" | "completed" | "abandoned" | "failed";
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  expiresAt: Date;
}

export interface ReviewAudioRecord extends ReviewAudioDeclaration {
  id: string;
  submissionId: string;
  version: number;
  objectKey: string;
  finalizedAt: Date;
}

export interface CurationReviewInput {
  submissionId: string;
  artisticQuality: number;
  originalityIntent: number;
  productionReadiness: number;
  editorialFit: number;
  finalGrade: "A" | "B" | "C";
  rationale: string;
}

export interface CurationReviewResult {
  reviewId: string;
  submissionId: string;
  publicReference: string;
  status: "accepted" | "rejected";
  finalGrade: "A" | "B" | "C";
  resultingTrackId: string | null;
}

type RawResult<T extends Record<string, unknown>> = { rows: T[] } | T[];

function resultRows<T extends Record<string, unknown>>(result: RawResult<T>): T[] {
  return Array.isArray(result) ? result : result.rows;
}

function date(value: Date | string | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

function mapSession(row: Record<string, unknown>): ReviewAudioUploadSession {
  return {
    id: String(row.id),
    submissionId: String(row.submissionId),
    stagingObjectKey: String(row.stagingObjectKey),
    originalFilename: String(row.originalFilename),
    filename: String(row.originalFilename),
    mimeType: String(row.mimeType),
    checksumSha256: String(row.checksumSha256),
    byteSize: Number(row.byteSize),
    durationMs: Number(row.durationMs),
    codec: String(row.codec),
    status: String(row.status) as ReviewAudioUploadSession["status"],
    leaseToken: row.leaseToken ? String(row.leaseToken) : null,
    leaseExpiresAt: date((row.leaseExpiresAt as Date | string | null) ?? null),
    expiresAt: date(row.expiresAt as Date | string)!,
  };
}

function mapAudio(row: Record<string, unknown>): ReviewAudioRecord {
  return {
    id: String(row.id),
    submissionId: String(row.submissionId),
    version: Number(row.version),
    objectKey: String(row.objectKey),
    originalFilename: String(row.originalFilename),
    filename: String(row.originalFilename),
    mimeType: String(row.mimeType),
    checksumSha256: String(row.checksumSha256),
    byteSize: Number(row.byteSize),
    durationMs: Number(row.durationMs),
    codec: String(row.codec),
    finalizedAt: date(row.finalizedAt as Date | string)!,
  };
}

const sessionColumns = sql`
  sessions.id as "id",
  sessions.submission_id as "submissionId",
  sessions.staging_object_key as "stagingObjectKey",
  sessions.original_filename as "originalFilename",
  sessions.mime_type as "mimeType",
  sessions.checksum_sha256 as "checksumSha256",
  sessions.byte_size as "byteSize",
  sessions.duration_ms as "durationMs",
  sessions.codec as "codec",
  sessions.status as "status",
  sessions.lease_token as "leaseToken",
  sessions.lease_expires_at as "leaseExpiresAt",
  sessions.expires_at as "expiresAt"
`;

const audioColumns = sql`
  audio.id as "id",
  audio.submission_id as "submissionId",
  audio.version as "version",
  audio.object_key as "objectKey",
  audio.original_filename as "originalFilename",
  audio.mime_type as "mimeType",
  audio.checksum_sha256 as "checksumSha256",
  audio.byte_size as "byteSize",
  audio.duration_ms as "durationMs",
  audio.codec as "codec",
  audio.finalized_at as "finalizedAt"
`;

function slug(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

export function createCurationWorkflowRepository(db: Database) {
  async function execute<T extends Record<string, unknown>>(query: SQL): Promise<T[]> {
    return resultRows((await db.execute<T>(query)) as RawResult<T>);
  }

  return {
    async createAudioUploadSession(
      tokenHash: string,
      declaration: ReviewAudioDeclaration,
      now: Date,
    ): Promise<ReviewAudioUploadSession | null> {
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(now.getTime() + REVIEW_AUDIO_UPLOAD_TTL_MS);
      const stagingObjectKey = `private/review-audio/staging/${sessionId}`;
      const rows = await execute<Record<string, unknown>>(sql`
        with eligible as (
          select submissions.id
          from submissions
          join submission_invitations invitations on invitations.id = submissions.invitation_id
          where invitations.token_hash = ${tokenHash}
            and invitations.revoked_at is null
            and invitations.expires_at > ${now.toISOString()}::timestamptz
            and submissions.status in ('draft', 'received', 'clarification_requested')
          for update of submissions
        ), inserted as (
          insert into submission_audio_upload_sessions (
            id, submission_id, staging_object_key, original_filename, mime_type,
            checksum_sha256, byte_size, duration_ms, codec, expires_at
          )
          select
            ${sessionId}::uuid, eligible.id, ${stagingObjectKey}, ${declaration.filename},
            ${declaration.mimeType}, ${declaration.checksumSha256}, ${declaration.byteSize},
            ${declaration.durationMs}, ${declaration.codec}, ${expiresAt.toISOString()}::timestamptz
          from eligible
          returning *
        )
        select ${sessionColumns} from inserted sessions
      `);
      return rows[0] ? mapSession(rows[0]) : null;
    },

    async getAudioUploadSession(sessionId: string): Promise<ReviewAudioUploadSession | null> {
      const rows = await execute<Record<string, unknown>>(sql`
        select ${sessionColumns}
        from submission_audio_upload_sessions sessions
        where sessions.id = ${sessionId}::uuid
      `);
      return rows[0] ? mapSession(rows[0]) : null;
    },

    async claimAudioFinalization(
      sessionId: string,
      tokenHash: string,
      now: Date,
    ): Promise<ReviewAudioUploadSession | null> {
      const leaseToken = crypto.randomUUID();
      const leaseExpiresAt = new Date(now.getTime() + REVIEW_AUDIO_FINALIZE_LEASE_MS);
      const rows = await execute<Record<string, unknown>>(sql`
        with claimed as (
          update submission_audio_upload_sessions sessions
          set status = 'finalizing', lease_token = ${leaseToken}::uuid,
              lease_expires_at = ${leaseExpiresAt.toISOString()}::timestamptz, updated_at = ${now.toISOString()}::timestamptz
          from submissions, submission_invitations invitations
          where sessions.id = ${sessionId}::uuid
            and submissions.id = sessions.submission_id
            and invitations.id = submissions.invitation_id
            and invitations.token_hash = ${tokenHash}
            and invitations.revoked_at is null
            and invitations.expires_at > ${now.toISOString()}::timestamptz
            and submissions.status in ('draft', 'received', 'clarification_requested')
            and sessions.expires_at > ${now.toISOString()}::timestamptz
            and (sessions.status = 'pending' or (sessions.status = 'finalizing' and sessions.lease_expires_at <= ${now.toISOString()}::timestamptz))
          returning sessions.*
        )
        select ${sessionColumns} from claimed sessions
      `);
      return rows[0] ? mapSession(rows[0]) : null;
    },

    async completeAudioFinalization(
      sessionId: string,
      leaseToken: string,
      finalObjectKey: string,
      now: Date,
    ): Promise<ReviewAudioRecord | null> {
      const audioId = crypto.randomUUID();
      const rows = await execute<Record<string, unknown>>(sql`
        with locked_submission as (
          select submissions.id
          from submissions
          join submission_audio_upload_sessions sessions on sessions.submission_id = submissions.id
          where sessions.id = ${sessionId}::uuid
          for update of submissions
        ), current_session as (
          select sessions.*
          from submission_audio_upload_sessions sessions
          join locked_submission on locked_submission.id = sessions.submission_id
          where sessions.id = ${sessionId}::uuid
            and sessions.status = 'finalizing'
            and sessions.lease_token = ${leaseToken}::uuid
            and sessions.lease_expires_at > ${now.toISOString()}::timestamptz
        ), inserted as (
          insert into submission_review_audio (
            id, submission_id, upload_session_id, version, object_key, original_filename,
            mime_type, checksum_sha256, byte_size, duration_ms, codec, finalized_at
          )
          select ${audioId}::uuid, current_session.submission_id, current_session.id,
            coalesce((select max(version) + 1 from submission_review_audio where submission_id = current_session.submission_id), 1),
            ${finalObjectKey}, current_session.original_filename, current_session.mime_type,
            current_session.checksum_sha256, current_session.byte_size, current_session.duration_ms,
            current_session.codec, ${now.toISOString()}::timestamptz
          from current_session
          returning *
        ), selected as (
          insert into submission_review_audio_selections (submission_id, audio_id, selected_at, updated_at)
          select inserted.submission_id, inserted.id, ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz
          from inserted
          on conflict (submission_id) do update
          set audio_id = excluded.audio_id, selected_at = excluded.selected_at, updated_at = excluded.updated_at
          returning submission_id
        ), completed as (
          update submission_audio_upload_sessions sessions
          set status = 'completed', completed_at = ${now.toISOString()}::timestamptz,
              lease_token = null, lease_expires_at = null, failure_code = null,
              updated_at = ${now.toISOString()}::timestamptz
          from inserted
          where sessions.id = inserted.upload_session_id
          returning sessions.id
        )
        select ${audioColumns}
        from inserted audio
        join selected on selected.submission_id = audio.submission_id
        join completed on completed.id = audio.upload_session_id
      `);
      return rows[0] ? mapAudio(rows[0]) : null;
    },

    async releaseAudioFinalization(
      sessionId: string,
      leaseToken: string,
      failureCode: string,
      now: Date,
    ): Promise<void> {
      await execute(sql`
        update submission_audio_upload_sessions
        set status = 'pending', lease_token = null, lease_expires_at = null,
            failure_code = ${failureCode}, updated_at = ${now.toISOString()}::timestamptz
        where id = ${sessionId}::uuid and status = 'finalizing' and lease_token = ${leaseToken}::uuid
        returning id
      `);
    },

    async currentAudioForSubmission(submissionId: string): Promise<ReviewAudioRecord | null> {
      const rows = await execute<Record<string, unknown>>(sql`
        select ${audioColumns}
        from submission_review_audio_selections selections
        join submission_review_audio audio on audio.id = selections.audio_id
        where selections.submission_id = ${submissionId}::uuid
      `);
      return rows[0] ? mapAudio(rows[0]) : null;
    },

    async currentAudioByTokenHash(tokenHash: string, now: Date): Promise<ReviewAudioRecord | null> {
      const rows = await execute<Record<string, unknown>>(sql`
        select ${audioColumns}
        from submission_invitations invitations
        join submissions on submissions.invitation_id = invitations.id
        join submission_review_audio_selections selections on selections.submission_id = submissions.id
        join submission_review_audio audio on audio.id = selections.audio_id
        where invitations.token_hash = ${tokenHash}
          and invitations.revoked_at is null and invitations.expires_at > ${now.toISOString()}::timestamptz
      `);
      return rows[0] ? mapAudio(rows[0]) : null;
    },

    async audioForCurator(audioId: string): Promise<ReviewAudioRecord | null> {
      const rows = await execute<Record<string, unknown>>(sql`
        select ${audioColumns}
        from submission_review_audio audio
        where audio.id = ${audioId}::uuid
      `);
      return rows[0] ? mapAudio(rows[0]) : null;
    },

    async abandonExpiredAudioUploads(now: Date): Promise<string[]> {
      const rows = await execute<{ stagingObjectKey: string }>(sql`
        with expired as (
          update submission_audio_upload_sessions
          set status = 'abandoned', lease_token = null, lease_expires_at = null,
              failure_code = 'UPLOAD_EXPIRED', updated_at = ${now.toISOString()}::timestamptz
          where status in ('pending', 'finalizing') and expires_at <= ${now.toISOString()}::timestamptz
          returning staging_object_key
        )
        select distinct staging_object_key as "stagingObjectKey" from expired
        union
        select staging_object_key as "stagingObjectKey"
        from submission_audio_upload_sessions
        where status = 'abandoned' and failure_code <> 'UPLOAD_CLEANED'
      `);
      return rows.map((row) => row.stagingObjectKey);
    },

    async markAudioUploadCleaned(stagingObjectKey: string, now: Date): Promise<void> {
      await execute(sql`
        update submission_audio_upload_sessions
        set failure_code = 'UPLOAD_CLEANED', updated_at = ${now.toISOString()}::timestamptz
        where staging_object_key = ${stagingObjectKey} and status = 'abandoned'
        returning id
      `);
    },

    async claimNextSubmission(curator: CuratorIdentity, now: Date): Promise<string | null> {
      const rows = await execute<{ id: string }>(sql`
        with already_claimed as (
          select id, 0 as priority, submitted_at
          from submissions
          where status = 'listening' and assigned_curator_id = ${curator.id}
          order by submitted_at, id
          limit 1
        ), candidate as (
          select submissions.id, 1 as priority, submissions.submitted_at
          from submissions
          join submission_review_audio_selections audio on audio.submission_id = submissions.id
          where submissions.status in ('received', 'eligibility_review')
            and submissions.assigned_curator_id is null
            and exists (
              select 1 from rights_declarations
              where submission_id = submissions.id and status = 'attested'
                and authority_basis <> 'other' and cardinality(territories) > 0
                and nullif(btrim(entitlement_statement), '') is not null
            )
            and exists (
              select 1 from creative_process_disclosures
              where submission_id = submissions.id and status = 'finalized'
                and nullif(btrim(artist_summary), '') is not null
                and jsonb_array_length(human_roles) > 0
                and (not ai_used or jsonb_array_length(ai_tools) > 0)
            )
            and exists (select 1 from provenance_records where submission_id = submissions.id and status = 'finalized')
          order by submissions.submitted_at, submissions.id
          limit 1
          for update of submissions skip locked
        ), picked as (
          select id from (select * from already_claimed union all select * from candidate) queue
          order by priority, submitted_at, id limit 1
        ), claimed as (
          update submissions
          set status = 'listening', assigned_curator_id = ${curator.id},
              assigned_curator_email = ${curator.email}, assigned_at = coalesce(assigned_at, ${now.toISOString()}::timestamptz),
              reviewed_at = coalesce(reviewed_at, ${now.toISOString()}::timestamptz), updated_at = ${now.toISOString()}::timestamptz
          from picked
          where submissions.id = picked.id
          returning submissions.id
        )
        select id from claimed
      `);
      return rows[0]?.id ?? null;
    },

    async finalizeReview(
      input: CurationReviewInput,
      curator: CuratorIdentity,
      now: Date,
    ): Promise<CurationReviewResult | null> {
      const reviewId = crypto.randomUUID();
      const artistId = crypto.randomUUID();
      const releaseId = crypto.randomUUID();
      const trackId = crypto.randomUUID();
      const referenceRows = await execute<{
        publicReference: string;
        artistName: string;
        title: string;
      }>(sql`
        select public_reference as "publicReference", artist_details->>'displayName' as "artistName", title
        from submissions
        where id = ${input.submissionId}::uuid and status = 'listening'
          and assigned_curator_id = ${curator.id}
      `);
      const reference = referenceRows[0];
      if (!reference) return null;
      const suffix = reference.publicReference
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(-10);
      const artistSlug = `${slug(reference.artistName, "artist")}-${suffix}`;
      const releaseSlug = `${slug(reference.title, "release")}-${suffix}`;
      const trackSlug = `${slug(reference.title, "track")}-${suffix}`;
      const accepted = input.finalGrade !== "C";
      const rows = await execute<Record<string, unknown>>(sql`
        with locked as (
          select submissions.*
          from submissions
          where id = ${input.submissionId}::uuid and status = 'listening'
            and assigned_curator_id = ${curator.id}
          for update
        ), current_rights as (
          select rights_declarations.* from rights_declarations join locked on locked.id = rights_declarations.submission_id
          where rights_declarations.status = 'attested'
            and rights_declarations.authority_basis <> 'other'
            and cardinality(rights_declarations.territories) > 0
            and nullif(btrim(rights_declarations.entitlement_statement), '') is not null
          order by rights_declarations.version desc limit 1
        ), current_process as (
          select creative_process_disclosures.* from creative_process_disclosures join locked on locked.id = creative_process_disclosures.submission_id
          where creative_process_disclosures.status = 'finalized'
            and nullif(btrim(creative_process_disclosures.artist_summary), '') is not null
            and jsonb_array_length(creative_process_disclosures.human_roles) > 0
            and (not creative_process_disclosures.ai_used or jsonb_array_length(creative_process_disclosures.ai_tools) > 0)
          order by creative_process_disclosures.version desc limit 1
        ), current_provenance as (
          select provenance_records.* from provenance_records join locked on locked.id = provenance_records.submission_id
          where provenance_records.status = 'finalized' order by provenance_records.version desc limit 1
        ), selected_audio as (
          select audio.* from submission_review_audio_selections selections
          join submission_review_audio audio on audio.id = selections.audio_id
          join locked on locked.id = selections.submission_id
        ), inserted_review as (
          insert into curation_reviews (
            id, submission_id, version, eligibility, artistic_quality, originality_intent,
            production_readiness, editorial_fit, final_grade, rationale, curator_id,
            curator_email, rights_declaration_id, creative_process_disclosure_id,
            provenance_record_id, review_audio_id, finalized_at
          )
          select ${reviewId}::uuid, locked.id,
            coalesce((select max(version) + 1 from curation_reviews where submission_id = locked.id), 1),
            'eligible', ${input.artisticQuality}, ${input.originalityIntent},
            ${input.productionReadiness}, ${input.editorialFit}, ${input.finalGrade},
            ${input.rationale}, ${curator.id}, ${curator.email}, current_rights.id,
            current_process.id, current_provenance.id, selected_audio.id,
            ${now.toISOString()}::timestamptz
          from locked, current_rights, current_process, current_provenance, selected_audio
          returning *
        ), created_artist as (
          insert into artists (id, slug, display_name, biography)
          select ${artistId}::uuid, ${artistSlug}, coalesce(nullif(locked.artist_details->>'displayName', ''), locked.submitter_name),
            nullif(locked.artist_details->>'shortBiography', '')
          from locked, inserted_review where ${accepted}
          returning id
        ), created_release as (
          insert into releases (id, slug, title)
          select ${releaseId}::uuid, ${releaseSlug}, locked.title
          from locked, inserted_review where ${accepted}
          returning id
        ), release_credit as (
          insert into release_artist_credits (release_id, artist_id, position, credited_as)
          select created_release.id, created_artist.id, 1,
            coalesce(nullif(locked.artist_details->>'displayName', ''), locked.submitter_name)
          from created_release, created_artist, locked returning release_id
        ), created_track as (
          insert into tracks (id, release_id, slug, title, position)
          select ${trackId}::uuid, created_release.id, ${trackSlug}, locked.title, 1
          from created_release, release_credit, locked returning id
        ), track_credit as (
          insert into track_artist_credits (track_id, artist_id, position, credited_as)
          select created_track.id, created_artist.id, 1,
            coalesce(nullif(locked.artist_details->>'displayName', ''), locked.submitter_name)
          from created_track, created_artist, locked returning track_id
        ), decided as (
          update submissions
          set status = ${accepted ? "accepted" : "rejected"}::submission_status,
              reviewed_at = ${now.toISOString()}::timestamptz,
              accepted_at = ${accepted ? now.toISOString() : null}::timestamptz,
              rejected_at = ${accepted ? null : now.toISOString()}::timestamptz,
              rejection_reason = ${accepted ? null : input.rationale},
              resulting_track_id = ${accepted ? trackId : null}::uuid,
              accepted_rights_declaration_id = case when ${accepted} then (select id from current_rights) else null end,
              accepted_creative_process_disclosure_id = case when ${accepted} then (select id from current_process) else null end,
              accepted_provenance_record_id = case when ${accepted} then (select id from current_provenance) else null end,
              review_notes = ${input.rationale}, updated_at = ${now.toISOString()}::timestamptz
          from inserted_review
          where submissions.id = inserted_review.submission_id
            and (${!accepted} or exists (select 1 from track_credit))
          returning submissions.*
        ), activity as (
          insert into submission_activities (
            submission_id, activity_type, actor_role, actor_id, actor_email,
            from_status, to_status, message, metadata, created_at
          )
          select decided.id, 'status_change', 'curator', ${curator.id}, ${curator.email},
            'listening', decided.status, ${input.rationale},
            jsonb_build_object('curationReviewId', ${reviewId}, 'finalGrade', ${input.finalGrade}, 'featureDistinction', ${input.finalGrade === "A"}),
            ${now.toISOString()}::timestamptz
          from decided returning submission_id
        ), queued as (
          insert into curation_outbox (idempotency_key, kind, payload)
          select 'submission:' || decided.id::text || ':review:' || ${reviewId} || ':decision-email',
            'submission_decision_email',
            jsonb_build_object(
              'submissionId', decided.id, 'recipient', decided.submitter_email,
              'publicReference', decided.public_reference, 'grade', ${input.finalGrade},
              'status', decided.status, 'rationale', ${input.rationale}
            )
          from decided
          on conflict (idempotency_key) do nothing
          returning id
        )
        select inserted_review.id as "reviewId", decided.id as "submissionId",
          decided.public_reference as "publicReference", decided.status as "status",
          inserted_review.final_grade as "finalGrade", decided.resulting_track_id as "resultingTrackId"
        from inserted_review
        join decided on decided.id = inserted_review.submission_id
        join activity on activity.submission_id = decided.id
        left join queued on true
      `);
      const row = rows[0];
      return row
        ? {
            reviewId: String(row.reviewId),
            submissionId: String(row.submissionId),
            publicReference: String(row.publicReference),
            status: String(row.status) as "accepted" | "rejected",
            finalGrade: String(row.finalGrade) as "A" | "B" | "C",
            resultingTrackId: row.resultingTrackId ? String(row.resultingTrackId) : null,
          }
        : null;
    },
  };
}

export type CurationWorkflowRepository = ReturnType<typeof createCurationWorkflowRepository>;
