import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { releases, tracks } from "./catalogue";
import {
  evidenceAccessAction,
  submissionActivityType,
  submissionActorRole,
  submissionKind,
  submissionStatus,
  uploadSessionStatus,
} from "./enums";
import { timestamps } from "./helpers";
import type {
  ArtistSubmissionDetails,
  ContactSubmissionDetails,
  ReleaseSubmissionDetails,
  SubmissionAbuseSignals,
  SubmissionAcknowledgements,
  TrackSubmissionDetails,
} from "~/types/submissions";

export const submissionInvitations = pgTable(
  "submission_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicReference: text("public_reference").notNull(),
    tokenHash: text("token_hash").notNull(),
    inviteeName: text("invitee_name"),
    inviteeEmail: text("invitee_email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("submission_invitations_public_reference_unique").on(table.publicReference),
    uniqueIndex("submission_invitations_token_hash_unique").on(table.tokenHash),
    index("submission_invitations_active_idx").on(table.expiresAt, table.revokedAt),
    check(
      "submission_invitations_public_reference_check",
      sql`nullif(btrim(${table.publicReference}), '') is not null`,
    ),
    check("submission_invitations_token_hash_check", sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "submission_invitations_email_check",
      sql`position('@' in ${table.inviteeEmail}) > 1 and nullif(btrim(${table.inviteeEmail}), '') is not null`,
    ),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => submissionInvitations.id, { onDelete: "restrict" }),
    publicReference: text("public_reference").notNull(),
    invitationReference: text("invitation_reference").notNull(),
    submissionKind: submissionKind("submission_kind").default("track").notNull(),
    submitterName: text("submitter_name").notNull(),
    submitterEmail: text("submitter_email").notNull(),
    title: text("title").notNull(),
    artistDetails: jsonb("artist_details")
      .$type<ArtistSubmissionDetails>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    releaseDetails: jsonb("release_details")
      .$type<ReleaseSubmissionDetails>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    trackDetails: jsonb("track_details")
      .$type<TrackSubmissionDetails>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    contactDetails: jsonb("contact_details")
      .$type<ContactSubmissionDetails>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    acknowledgements: jsonb("acknowledgements")
      .$type<SubmissionAcknowledgements>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    abuseSignals: jsonb("abuse_signals")
      .$type<SubmissionAbuseSignals>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    status: submissionStatus("status").default("draft").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    assignedCuratorId: text("assigned_curator_id"),
    assignedCuratorEmail: text("assigned_curator_email"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    resultingReleaseId: uuid("resulting_release_id").references(() => releases.id, {
      onDelete: "restrict",
    }),
    resultingTrackId: uuid("resulting_track_id").references(() => tracks.id, {
      onDelete: "restrict",
    }),
    acceptedRightsDeclarationId: uuid("accepted_rights_declaration_id"),
    acceptedCreativeProcessDisclosureId: uuid("accepted_creative_process_disclosure_id"),
    acceptedProvenanceRecordId: uuid("accepted_provenance_record_id"),
    reviewNotes: text("review_notes"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("submissions_public_reference_unique").on(table.publicReference),
    uniqueIndex("submissions_invitation_id_unique").on(table.invitationId),
    index("submissions_invitation_reference_idx").on(table.invitationReference),
    index("submissions_status_queue_idx").on(table.status, table.submittedAt),
    index("submissions_review_queue_idx").on(table.status, table.reviewedAt),
    index("submissions_assignment_idx").on(table.assignedCuratorEmail, table.status),
    index("submissions_resulting_release_id_idx").on(table.resultingReleaseId),
    index("submissions_resulting_track_id_idx").on(table.resultingTrackId),
    check(
      "submissions_public_reference_check",
      sql`nullif(btrim(${table.publicReference}), '') is not null`,
    ),
    check(
      "submissions_submitted_timestamp_check",
      sql`(${table.status} = 'draft' and ${table.submittedAt} is null) or (${table.status} <> 'draft' and ${table.submittedAt} is not null)`,
    ),
    check(
      "submissions_reviewed_timestamp_check",
      sql`${table.status} not in ('eligibility_review', 'listening', 'clarification_requested', 'accepted', 'rejected') or ${table.reviewedAt} is not null`,
    ),
    check(
      "submissions_accepted_timestamp_check",
      sql`(${table.status} = 'accepted') = (${table.acceptedAt} is not null)`,
    ),
    check(
      "submissions_rejected_timestamp_check",
      sql`(${table.status} = 'rejected') = (${table.rejectedAt} is not null)`,
    ),
    check(
      "submissions_withdrawn_timestamp_check",
      sql`(${table.status} = 'withdrawn') = (${table.withdrawnAt} is not null)`,
    ),
    check(
      "submissions_assignment_check",
      sql`(${table.assignedCuratorId} is null and ${table.assignedCuratorEmail} is null and ${table.assignedAt} is null)
        or (${table.assignedCuratorId} is not null and ${table.assignedCuratorEmail} is not null and ${table.assignedAt} is not null)`,
    ),
    check(
      "submissions_rejection_reason_check",
      sql`${table.status} <> 'rejected' or nullif(btrim(${table.rejectionReason}), '') is not null`,
    ),
    check(
      "submissions_acceptance_pins_check",
      sql`${table.status} <> 'accepted' or (
        ${table.acceptedRightsDeclarationId} is not null
        and ${table.acceptedCreativeProcessDisclosureId} is not null
        and ${table.acceptedProvenanceRecordId} is not null
      )`,
    ),
    check(
      "submissions_resulting_catalogue_check",
      sql`num_nonnulls(${table.resultingReleaseId}, ${table.resultingTrackId}) <= 1 and (num_nonnulls(${table.resultingReleaseId}, ${table.resultingTrackId}) = 0 or ${table.status} = 'accepted')`,
    ),
  ],
);

export const submissionActivities = pgTable(
  "submission_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    activityType: submissionActivityType("activity_type").notNull(),
    actorRole: submissionActorRole("actor_role").notNull(),
    actorId: text("actor_id"),
    actorEmail: text("actor_email"),
    fromStatus: submissionStatus("from_status"),
    toStatus: submissionStatus("to_status"),
    claimKey: text("claim_key"),
    message: text("message"),
    metadata: jsonb("metadata")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("submission_activities_submission_created_idx").on(table.submissionId, table.createdAt),
    index("submission_activities_type_idx").on(table.activityType, table.createdAt),
    check(
      "submission_activities_status_change_check",
      sql`${table.activityType} <> 'status_change'
        or (${table.fromStatus} is not null and ${table.toStatus} is not null)`,
    ),
  ],
);

export const evidenceUploadSessions = pgTable(
  "evidence_upload_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    provenanceRecordId: uuid("provenance_record_id").notNull(),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    status: uploadSessionStatus("status").default("pending").notNull(),
    actorRole: submissionActorRole("actor_role").notNull(),
    actorEmail: text("actor_email"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("evidence_upload_sessions_object_key_unique").on(table.objectKey),
    index("evidence_upload_sessions_cleanup_idx").on(table.status, table.expiresAt),
    index("evidence_upload_sessions_submission_idx").on(table.submissionId, table.createdAt),
    check(
      "evidence_upload_sessions_object_key_check",
      sql`${table.objectKey} like 'private/evidence/%'`,
    ),
    check(
      "evidence_upload_sessions_filename_check",
      sql`nullif(btrim(${table.originalFilename}), '') is not null`,
    ),
    check(
      "evidence_upload_sessions_checksum_check",
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check("evidence_upload_sessions_byte_size_check", sql`${table.byteSize} > 0`),
    check(
      "evidence_upload_sessions_state_check",
      sql`(
        (${table.status} = 'pending' and ${table.completedAt} is null and ${table.failureReason} is null)
        or (${table.status} = 'completed' and ${table.completedAt} is not null and ${table.failureReason} is null)
        or (${table.status} in ('abandoned', 'failed') and ${table.completedAt} is null)
      )`,
    ),
  ],
);

export const provenanceEvidenceAccessGrants = pgTable(
  "provenance_evidence_access_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    evidenceId: uuid("evidence_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    actorId: text("actor_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("provenance_evidence_access_grants_token_hash_unique").on(table.tokenHash),
    index("provenance_evidence_access_grants_expiry_idx").on(table.expiresAt),
    check(
      "provenance_evidence_access_grants_token_hash_check",
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const provenanceEvidenceAccessAudit = pgTable(
  "provenance_evidence_access_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    evidenceId: uuid("evidence_id").notNull(),
    grantId: uuid("grant_id"),
    actorId: text("actor_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    action: evidenceAccessAction("action").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("provenance_evidence_access_audit_evidence_idx").on(table.evidenceId, table.occurredAt),
    index("provenance_evidence_access_audit_actor_idx").on(table.actorId, table.occurredAt),
  ],
);
