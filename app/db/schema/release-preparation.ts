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
import { submissions } from "./submissions";
import { tracks } from "./catalogue";
import { curationReviews, submissionReviewAudio } from "./curation-workflow";

export const submissionReleaseProjects = pgTable(
  "submission_release_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerEmail: text("owner_email").notNull(),
    artistName: text("artist_name").notNull(),
    title: text("title").notNull(),
    artistId: uuid("artist_id").notNull().defaultRandom(),
    releaseId: uuid("release_id").notNull().defaultRandom(),
    originSubmissionId: uuid("origin_submission_id")
      .notNull()
      .references(() => submissions.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("submission_release_projects_origin_unique").on(t.originSubmissionId),
    index("submission_release_projects_owner_idx").on(t.ownerEmail),
  ],
);

export const submissionCoverUploads = pgTable(
  "submission_cover_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    rightsStatement: text("rights_statement").notNull(),
    rightsAcknowledgedAt: timestamp("rights_acknowledged_at", { withTimezone: true }).notNull(),
    stagingObjectKey: text("staging_object_key").notNull(),
    objectKey: text("object_key"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("submission_cover_uploads_submission_idx").on(t.submissionId),
    check("submission_cover_size_check", sql`${t.byteSize} between 1 and 20971520`),
    check(
      "submission_cover_dimensions_check",
      sql`${t.width} between 1400 and 10000 and ${t.width} = ${t.height}`,
    ),
    check("submission_cover_hash_check", sql`${t.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    check(
      "submission_cover_status_check",
      sql`${t.status} in ('pending','finalizing','ready','failed')`,
    ),
    check(
      "submission_cover_ready_check",
      sql`${t.status} <> 'ready' or (${t.objectKey} is not null and ${t.finalizedAt} is not null)`,
    ),
  ],
);

export const submissionCoverSelections = pgTable("submission_cover_selections", {
  submissionId: uuid("submission_id")
    .primaryKey()
    .references(() => submissions.id),
  coverId: uuid("cover_id")
    .notNull()
    .references(() => submissionCoverUploads.id),
});

export const releasePreparationJobs = pgTable(
  "release_preparation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => curationReviews.id),
    sourceAudioId: uuid("source_audio_id")
      .notNull()
      .references(() => submissionReviewAudio.id),
    coverId: uuid("cover_id").references(() => submissionCoverUploads.id),
    profile: text("profile").notNull(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    outputObjectKey: text("output_object_key"),
    outputChecksum: text("output_checksum"),
    outputByteSize: bigint("output_byte_size", { mode: "number" }),
    outputDurationMs: integer("output_duration_ms"),
    sampleRate: integer("sample_rate"),
    channels: integer("channels"),
    bitRate: integer("bit_rate"),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("release_preparation_track_unique").on(t.trackId),
    uniqueIndex("release_preparation_one_processing")
      .on(t.status)
      .where(sql`${t.status} = 'processing'`),
    uniqueIndex("release_preparation_review_unique").on(t.reviewId),
    index("release_preparation_pending_idx").on(t.status, t.nextAttemptAt),
    check(
      "release_preparation_status_check",
      sql`${t.status} in ('queued','processing','ready','failed')`,
    ),
    check(
      "release_preparation_ready_check",
      sql`${t.status} <> 'ready' or (${t.outputObjectKey} is not null and ${t.outputChecksum} is not null and ${t.outputChecksum} ~ '^[0-9a-f]{64}$' and ${t.outputByteSize} is not null and ${t.outputByteSize} > 0 and ${t.outputDurationMs} is not null and ${t.outputDurationMs} > 0 and ${t.sampleRate} is not null and ${t.sampleRate} = 44100 and ${t.channels} is not null and ${t.channels} = 2 and ${t.bitRate} is not null and ${t.bitRate} = 320000)`,
    ),
  ],
);
