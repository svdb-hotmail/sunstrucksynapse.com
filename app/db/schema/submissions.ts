import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { releases, tracks } from "./catalogue";
import { submissionStatus } from "./enums";
import { timestamps } from "./helpers";

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invitationReference: text("invitation_reference").notNull(),
    submitterName: text("submitter_name").notNull(),
    submitterEmail: text("submitter_email").notNull(),
    title: text("title").notNull(),
    status: submissionStatus("status").default("draft").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    resultingReleaseId: uuid("resulting_release_id").references(() => releases.id, {
      onDelete: "restrict",
    }),
    resultingTrackId: uuid("resulting_track_id").references(() => tracks.id, {
      onDelete: "restrict",
    }),
    reviewNotes: text("review_notes"),
    ...timestamps(),
  },
  (table) => [
    index("submissions_invitation_reference_idx").on(table.invitationReference),
    index("submissions_status_queue_idx").on(table.status, table.submittedAt),
    index("submissions_review_queue_idx").on(table.status, table.reviewedAt),
    index("submissions_resulting_release_id_idx").on(table.resultingReleaseId),
    index("submissions_resulting_track_id_idx").on(table.resultingTrackId),
    check(
      "submissions_submitted_timestamp_check",
      sql`(${table.status} = 'draft' and ${table.submittedAt} is null) or (${table.status} <> 'draft' and ${table.submittedAt} is not null)`,
    ),
    check(
      "submissions_reviewed_timestamp_check",
      sql`${table.status} not in ('changes_requested', 'accepted', 'rejected') or ${table.reviewedAt} is not null`,
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
      "submissions_resulting_catalogue_check",
      sql`num_nonnulls(${table.resultingReleaseId}, ${table.resultingTrackId}) <= 1 and (num_nonnulls(${table.resultingReleaseId}, ${table.resultingTrackId}) = 0 or ${table.status} = 'accepted')`,
    ),
  ],
);
