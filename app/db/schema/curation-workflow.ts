import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "./helpers";
import { creativeProcessDisclosures, provenanceRecords, rightsDeclarations } from "./governance";
import { submissions } from "./submissions";

export const submissionAudioUploadSessions = pgTable(
  "submission_audio_upload_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    stagingObjectKey: text("staging_object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    codec: text("codec").notNull(),
    status: text("status").default("pending").notNull(),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("submission_audio_upload_sessions_staging_key_unique").on(table.stagingObjectKey),
    index("submission_audio_upload_sessions_cleanup_idx").on(table.status, table.expiresAt),
    index("submission_audio_upload_sessions_submission_idx").on(
      table.submissionId,
      table.createdAt,
    ),
    check(
      "submission_audio_upload_sessions_key_check",
      sql`${table.stagingObjectKey} like 'private/review-audio/staging/%'`,
    ),
    check(
      "submission_audio_upload_sessions_metadata_check",
      sql`nullif(btrim(${table.originalFilename}), '') is not null
        and ${table.mimeType} in ('audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/flac')
        and ${table.checksumSha256} ~ '^[0-9a-f]{64}$'
        and ${table.byteSize} between 1 and 524288000
        and ${table.durationMs} between 1 and 86400000
        and nullif(btrim(${table.codec}), '') is not null`,
    ),
    check(
      "submission_audio_upload_sessions_status_check",
      sql`${table.status} in ('pending', 'finalizing', 'completed', 'abandoned', 'failed')`,
    ),
    check(
      "submission_audio_upload_sessions_lease_check",
      sql`(${table.status} = 'finalizing') = (${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null)`,
    ),
    check(
      "submission_audio_upload_sessions_completion_check",
      sql`(${table.status} = 'completed') = (${table.completedAt} is not null)`,
    ),
    check(
      "submission_audio_upload_sessions_failure_check",
      sql`${table.failureCode} is null or ${table.failureCode} ~ '^[A-Z][A-Z0-9_]{0,63}$'`,
    ),
  ],
);

export const submissionReviewAudio = pgTable(
  "submission_review_audio",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    uploadSessionId: uuid("upload_session_id")
      .notNull()
      .references(() => submissionAudioUploadSessions.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    codec: text("codec").notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("submission_review_audio_upload_session_unique").on(table.uploadSessionId),
    uniqueIndex("submission_review_audio_object_key_unique").on(table.objectKey),
    uniqueIndex("submission_review_audio_submission_version_unique").on(
      table.submissionId,
      table.version,
    ),
    index("submission_review_audio_submission_idx").on(table.submissionId, table.finalizedAt),
    check(
      "submission_review_audio_key_check",
      sql`${table.objectKey} like 'private/review-audio/final/%'`,
    ),
    check("submission_review_audio_version_check", sql`${table.version} > 0`),
    check(
      "submission_review_audio_metadata_check",
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$' and ${table.byteSize} > 0 and ${table.durationMs} > 0`,
    ),
  ],
);

export const submissionReviewAudioSelections = pgTable(
  "submission_review_audio_selections",
  {
    submissionId: uuid("submission_id")
      .primaryKey()
      .references(() => submissions.id, { onDelete: "cascade" }),
    audioId: uuid("audio_id")
      .notNull()
      .references(() => submissionReviewAudio.id, { onDelete: "restrict" }),
    selectedAt: timestamp("selected_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("submission_review_audio_selections_audio_unique").on(table.audioId)],
);

export const curationReviews = pgTable(
  "curation_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    status: text("status").default("finalized").notNull(),
    eligibility: text("eligibility").notNull(),
    artisticQuality: integer("artistic_quality").notNull(),
    originalityIntent: integer("originality_intent").notNull(),
    productionReadiness: integer("production_readiness").notNull(),
    editorialFit: integer("editorial_fit").notNull(),
    finalGrade: text("final_grade").notNull(),
    rationale: text("rationale").notNull(),
    curatorId: text("curator_id").notNull(),
    curatorEmail: text("curator_email").notNull(),
    rightsDeclarationId: uuid("rights_declaration_id")
      .notNull()
      .references(() => rightsDeclarations.id, { onDelete: "restrict" }),
    creativeProcessDisclosureId: uuid("creative_process_disclosure_id")
      .notNull()
      .references(() => creativeProcessDisclosures.id, { onDelete: "restrict" }),
    provenanceRecordId: uuid("provenance_record_id")
      .notNull()
      .references(() => provenanceRecords.id, { onDelete: "restrict" }),
    reviewAudioId: uuid("review_audio_id")
      .notNull()
      .references(() => submissionReviewAudio.id, { onDelete: "restrict" }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("curation_reviews_submission_version_unique").on(table.submissionId, table.version),
    index("curation_reviews_grade_idx").on(table.finalGrade, table.finalizedAt),
    check("curation_reviews_status_check", sql`${table.status} = 'finalized'`),
    check("curation_reviews_eligibility_check", sql`${table.eligibility} = 'eligible'`),
    check(
      "curation_reviews_scores_check",
      sql`${table.artisticQuality} between 1 and 5
        and ${table.originalityIntent} between 1 and 5
        and ${table.productionReadiness} between 1 and 5
        and ${table.editorialFit} between 1 and 5`,
    ),
    check("curation_reviews_grade_check", sql`${table.finalGrade} in ('A', 'B', 'C')`),
    check(
      "curation_reviews_identity_check",
      sql`nullif(btrim(${table.curatorId}), '') is not null and position('@' in ${table.curatorEmail}) > 1`,
    ),
    check(
      "curation_reviews_rationale_check",
      sql`nullif(btrim(${table.rationale}), '') is not null`,
    ),
  ],
);
