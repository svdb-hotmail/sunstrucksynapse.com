CREATE TYPE "public"."evidence_access_action" AS ENUM('grant_created', 'downloaded');--> statement-breakpoint
CREATE TYPE "public"."evidence_malware_status" AS ENUM('pending_review', 'cleared', 'quarantined', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."submission_activity_type" AS ENUM('status_change', 'assignment', 'note', 'clarification_question', 'clarification_response', 'email', 'evidence_access');--> statement-breakpoint
CREATE TYPE "public"."submission_actor_role" AS ENUM('submitter', 'curator', 'system');--> statement-breakpoint
CREATE TYPE "public"."submission_kind" AS ENUM('track', 'release');--> statement-breakpoint
CREATE TABLE "evidence_upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"provenance_record_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"status" "upload_session_status" DEFAULT 'pending' NOT NULL,
	"actor_role" "submission_actor_role" NOT NULL,
	"actor_email" text,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_upload_sessions_object_key_check" CHECK ("evidence_upload_sessions"."object_key" like 'private/evidence/%'),
	CONSTRAINT "evidence_upload_sessions_filename_check" CHECK (nullif(btrim("evidence_upload_sessions"."original_filename"), '') is not null),
	CONSTRAINT "evidence_upload_sessions_checksum_check" CHECK ("evidence_upload_sessions"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "evidence_upload_sessions_byte_size_check" CHECK ("evidence_upload_sessions"."byte_size" > 0),
	CONSTRAINT "evidence_upload_sessions_state_check" CHECK ((
        ("evidence_upload_sessions"."status" = 'pending' and "evidence_upload_sessions"."completed_at" is null and "evidence_upload_sessions"."failure_reason" is null)
        or ("evidence_upload_sessions"."status" = 'completed' and "evidence_upload_sessions"."completed_at" is not null and "evidence_upload_sessions"."failure_reason" is null)
        or ("evidence_upload_sessions"."status" in ('abandoned', 'failed') and "evidence_upload_sessions"."completed_at" is null)
      ))
);
--> statement-breakpoint
CREATE TABLE "provenance_evidence_access_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"grant_id" uuid,
	"actor_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"action" "evidence_access_action" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provenance_evidence_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"downloaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provenance_evidence_access_grants_token_hash_check" CHECK ("provenance_evidence_access_grants"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "submission_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"activity_type" "submission_activity_type" NOT NULL,
	"actor_role" "submission_actor_role" NOT NULL,
	"actor_id" text,
	"actor_email" text,
	"from_status" "submission_status",
	"to_status" "submission_status",
	"claim_key" text,
	"message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_activities_status_change_check" CHECK ("submission_activities"."activity_type" <> 'status_change'
        or ("submission_activities"."from_status" is not null and "submission_activities"."to_status" is not null))
);
--> statement-breakpoint
CREATE TABLE "submission_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_reference" text NOT NULL,
	"token_hash" text NOT NULL,
	"invitee_name" text,
	"invitee_email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_invitations_public_reference_check" CHECK (nullif(btrim("submission_invitations"."public_reference"), '') is not null),
	CONSTRAINT "submission_invitations_token_hash_check" CHECK ("submission_invitations"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "submission_invitations_email_check" CHECK (position('@' in "submission_invitations"."invitee_email") > 1 and nullif(btrim("submission_invitations"."invitee_email"), '') is not null)
);
--> statement-breakpoint
ALTER TABLE "provenance_evidence" DROP CONSTRAINT "provenance_evidence_object_key_check";--> statement-breakpoint
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_reviewed_timestamp_check";--> statement-breakpoint
ALTER TYPE "public"."submission_status" RENAME VALUE 'submitted' TO 'received';--> statement-breakpoint
ALTER TYPE "public"."submission_status" RENAME VALUE 'under_review' TO 'eligibility_review';--> statement-breakpoint
ALTER TYPE "public"."submission_status" RENAME VALUE 'changes_requested' TO 'clarification_requested';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE IF NOT EXISTS 'listening' AFTER 'eligibility_review';--> statement-breakpoint
DROP INDEX "provenance_evidence_storage_ref_unique";--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ALTER COLUMN "tools_and_systems" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "revision_author_role" "submission_actor_role" DEFAULT 'submitter' NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "revision_author_name" text DEFAULT 'Legacy submitter' NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "revision_author_email" text DEFAULT 'legacy@example.invalid' NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "revision_reason" text DEFAULT 'Phase 3 backfill' NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "human_roles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "ai_tools" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "lyrics_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "lyrics_details" text;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "voice_clone_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "voice_clone_details" text;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "samples_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "sample_details" text;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD COLUMN "private_notes" text;--> statement-breakpoint
ALTER TABLE "provenance_evidence" ADD COLUMN "original_filename" text DEFAULT 'legacy-evidence' NOT NULL;--> statement-breakpoint
ALTER TABLE "provenance_evidence" ADD COLUMN "malware_status" "evidence_malware_status" DEFAULT 'pending_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "provenance_evidence" ADD COLUMN "scheduled_deletion_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provenance_evidence" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD COLUMN "revision_author_role" "submission_actor_role" DEFAULT 'submitter' NOT NULL;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD COLUMN "revision_author_name" text DEFAULT 'Legacy submitter' NOT NULL;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD COLUMN "revision_author_email" text DEFAULT 'legacy@example.invalid' NOT NULL;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD COLUMN "revision_reason" text DEFAULT 'Phase 3 backfill' NOT NULL;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD COLUMN "public_notes" text;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD COLUMN "private_notes" text;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "revision_author_role" "submission_actor_role" DEFAULT 'submitter' NOT NULL;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "revision_author_name" text DEFAULT 'Legacy submitter' NOT NULL;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "revision_author_email" text DEFAULT 'legacy@example.invalid' NOT NULL;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "revision_reason" text DEFAULT 'Phase 3 backfill' NOT NULL;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "entitlement_statement" text DEFAULT 'Legacy rights statement' NOT NULL;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "public_summary" text DEFAULT 'Legacy rights summary' NOT NULL;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "public_notes" text;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "private_notes" text;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "territories" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "distributor_name" text;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "distributor_release_id" text;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD COLUMN "isrc" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "invitation_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "public_reference" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "submission_kind" "submission_kind" DEFAULT 'track' NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "artist_details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "release_details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "track_details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "contact_details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "acknowledgements" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "abuse_signals" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "assigned_curator_id" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "assigned_curator_email" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "accepted_rights_declaration_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "accepted_creative_process_disclosure_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "accepted_provenance_record_id" uuid;--> statement-breakpoint
-- This one-time legacy key normalization must update accepted evidence created before Phase 3.
-- Re-enable the draft-only trigger immediately so the invariant remains enforced after migration.
ALTER TABLE "provenance_evidence" DISABLE TRIGGER "provenance_evidence_require_draft";--> statement-breakpoint
UPDATE "provenance_evidence"
SET
	"object_key" = regexp_replace("object_key", '^evidence/private/', 'private/evidence/'),
	"original_filename" = split_part("object_key", '/', array_length(string_to_array("object_key", '/'), 1))
WHERE "object_key" like 'evidence/private/%';--> statement-breakpoint
ALTER TABLE "provenance_evidence" ENABLE TRIGGER "provenance_evidence_require_draft";--> statement-breakpoint
INSERT INTO "submission_invitations" (
	"id",
	"public_reference",
	"token_hash",
	"invitee_name",
	"invitee_email",
	"expires_at",
	"last_opened_at"
)
SELECT
	gen_random_uuid(),
	'INV-' || upper(replace(s."id"::text, '-', '')),
	repeat(md5(s."id"::text), 2),
	s."submitter_name",
	s."submitter_email",
	COALESCE(s."accepted_at", s."submitted_at", s."created_at", now()) + interval '10 years',
	COALESCE(s."updated_at", s."created_at", now())
FROM "submissions" s
WHERE s."invitation_id" is null;--> statement-breakpoint
UPDATE "submissions" s
SET
	"invitation_id" = i."id",
	"public_reference" = 'SUB-' || i."public_reference",
	"submission_kind" = CASE WHEN s."resulting_track_id" is not null THEN 'track'::"submission_kind" ELSE 'release'::"submission_kind" END,
	"artist_details" = jsonb_build_object(
		'displayName', s."submitter_name",
		'shortBiography', '',
		'location', '',
		'websiteUrl', '',
		'socialUrl', '',
		'priorWorkNotes', ''
	),
	"release_details" = jsonb_build_object(
		'title', s."title",
		'summary', coalesce(s."review_notes", ''),
		'plannedReleaseDate', '',
		'labelName', '',
		'distributorName', '',
		'distributorReleaseId', '',
		'territories', jsonb_build_array()
	),
	"track_details" = jsonb_build_object(
		'title', s."title",
		'versionTitle', '',
		'durationNotes', '',
		'isLeadSingle', false,
		'lyricsSummary', '',
		'isInstrumental', false
	),
	"contact_details" = jsonb_build_object(
		'contactName', s."submitter_name",
		'contactEmail', s."submitter_email",
		'contactPhone', '',
		'preferredContactMethod', 'email'
	),
	"acknowledgements" = jsonb_build_object(
		'invitationConfirmed', true,
		'accuracyConfirmed', true,
		'rightsConfirmed', true,
		'disclosureConfirmed', true,
		'reviewProcessConfirmed', true
	),
	"abuse_signals" = jsonb_build_object(
		'honeypotTriggered', false,
		'saveCount', 1,
		'submitCount', CASE WHEN s."status" = 'draft' THEN 0 ELSE 1 END,
		'lastUserAgent', 'legacy-migration',
		'lastIpHash', null
	)
FROM "submission_invitations" i
WHERE i."public_reference" = 'INV-' || upper(replace(s."id"::text, '-', ''))
  AND s."invitation_id" is null;--> statement-breakpoint
-- Preserve legacy accepted submissions whose detailed Phase 3 declarations were never recorded.
-- These final records deliberately disclose that the original detail is unavailable.
INSERT INTO "creative_process_disclosures" (
	"submission_id", "version", "status", "revision_author_role", "revision_author_name",
	"revision_author_email", "revision_reason", "ai_used", "meaningful_human_contribution",
	"tools_and_systems", "human_roles", "ai_tools", "artist_summary", "finalized_at"
)
SELECT
	s."id", 1, 'draft'::"versioned_record_status", 'submitter'::"submission_actor_role",
	COALESCE(NULLIF(btrim(s."submitter_name"), ''), 'Legacy submitter'),
	COALESCE(NULLIF(btrim(s."submitter_email"), ''), 'legacy@example.invalid'),
	'Phase 3 legacy acceptance backfill', false,
	'Legacy accepted submission; detailed contribution declaration was not recorded.',
	'{}'::text[], '[]'::jsonb, '[]'::jsonb,
	'Legacy accepted submission; detailed creative-process declaration unavailable.',
	NULL
FROM "submissions" s
WHERE s."status" = 'accepted'
  AND NOT EXISTS (
	SELECT 1 FROM "creative_process_disclosures" c WHERE c."submission_id" = s."id"
  );--> statement-breakpoint
INSERT INTO "provenance_records" (
	"submission_id", "version", "status", "revision_author_role", "revision_author_name",
	"revision_author_email", "revision_reason", "summary", "finalized_at"
)
SELECT
	s."id", 1, 'draft'::"versioned_record_status", 'submitter'::"submission_actor_role",
	COALESCE(NULLIF(btrim(s."submitter_name"), ''), 'Legacy submitter'),
	COALESCE(NULLIF(btrim(s."submitter_email"), ''), 'legacy@example.invalid'),
	'Phase 3 legacy acceptance backfill',
	'Legacy accepted submission; detailed provenance declaration unavailable.',
	NULL
FROM "submissions" s
WHERE s."status" = 'accepted'
  AND NOT EXISTS (
	SELECT 1 FROM "provenance_records" p WHERE p."submission_id" = s."id"
  );--> statement-breakpoint
UPDATE "creative_process_disclosures" c
SET "status" = 'finalized', "finalized_at" = COALESCE(s."accepted_at", s."reviewed_at", s."updated_at", s."created_at", now())
FROM "submissions" s
WHERE c."submission_id" = s."id"
  AND c."revision_reason" = 'Phase 3 legacy acceptance backfill'
  AND c."status" = 'draft';--> statement-breakpoint
UPDATE "provenance_records" p
SET "status" = 'finalized', "finalized_at" = COALESCE(s."accepted_at", s."reviewed_at", s."updated_at", s."created_at", now())
FROM "submissions" s
WHERE p."submission_id" = s."id"
  AND p."revision_reason" = 'Phase 3 legacy acceptance backfill'
  AND p."status" = 'draft';--> statement-breakpoint
UPDATE "submissions" s
SET
	"accepted_rights_declaration_id" = (
		SELECT "id"
		FROM "rights_declarations"
		WHERE "submission_id" = s."id"
		ORDER BY "version" desc
		LIMIT 1
	),
	"accepted_creative_process_disclosure_id" = (
		SELECT "id"
		FROM "creative_process_disclosures"
		WHERE "submission_id" = s."id"
		ORDER BY "version" desc
		LIMIT 1
	),
	"accepted_provenance_record_id" = (
		SELECT "id"
		FROM "provenance_records"
		WHERE "submission_id" = s."id"
		ORDER BY "version" desc
		LIMIT 1
	)
WHERE s."status" = 'accepted'
  AND s."accepted_rights_declaration_id" is null;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "invitation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "public_reference" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_upload_sessions" ADD CONSTRAINT "evidence_upload_sessions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_upload_sessions" ADD CONSTRAINT "evidence_upload_sessions_provenance_record_id_provenance_records_id_fk" FOREIGN KEY ("provenance_record_id") REFERENCES "public"."provenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_activities" ADD CONSTRAINT "submission_activities_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_evidence_access_grants" ADD CONSTRAINT "provenance_evidence_access_grants_evidence_id_provenance_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."provenance_evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_evidence_access_audit" ADD CONSTRAINT "provenance_evidence_access_audit_evidence_id_provenance_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."provenance_evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_evidence_access_audit" ADD CONSTRAINT "provenance_evidence_access_audit_grant_id_provenance_evidence_access_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."provenance_evidence_access_grants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_accepted_rights_declaration_id_rights_declarations_id_fk" FOREIGN KEY ("accepted_rights_declaration_id") REFERENCES "public"."rights_declarations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_accepted_creative_process_disclosure_id_creative_process_disclosures_id_fk" FOREIGN KEY ("accepted_creative_process_disclosure_id") REFERENCES "public"."creative_process_disclosures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_accepted_provenance_record_id_provenance_records_id_fk" FOREIGN KEY ("accepted_provenance_record_id") REFERENCES "public"."provenance_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_upload_sessions_object_key_unique" ON "evidence_upload_sessions" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "evidence_upload_sessions_cleanup_idx" ON "evidence_upload_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "evidence_upload_sessions_submission_idx" ON "evidence_upload_sessions" USING btree ("submission_id","created_at");--> statement-breakpoint
CREATE INDEX "provenance_evidence_access_audit_evidence_idx" ON "provenance_evidence_access_audit" USING btree ("evidence_id","occurred_at");--> statement-breakpoint
CREATE INDEX "provenance_evidence_access_audit_actor_idx" ON "provenance_evidence_access_audit" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_evidence_access_grants_token_hash_unique" ON "provenance_evidence_access_grants" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "provenance_evidence_access_grants_expiry_idx" ON "provenance_evidence_access_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "submission_activities_submission_created_idx" ON "submission_activities" USING btree ("submission_id","created_at");--> statement-breakpoint
CREATE INDEX "submission_activities_type_idx" ON "submission_activities" USING btree ("activity_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_invitations_public_reference_unique" ON "submission_invitations" USING btree ("public_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_invitations_token_hash_unique" ON "submission_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "submission_invitations_active_idx" ON "submission_invitations" USING btree ("expires_at","revoked_at");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_invitation_id_submission_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."submission_invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_evidence_record_storage_ref_unique" ON "provenance_evidence" USING btree ("provenance_record_id","storage_provider","object_key");--> statement-breakpoint
CREATE INDEX "provenance_evidence_malware_status_idx" ON "provenance_evidence" USING btree ("malware_status");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_public_reference_unique" ON "submissions" USING btree ("public_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_invitation_id_unique" ON "submissions" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "submissions_assignment_idx" ON "submissions" USING btree ("assigned_curator_email","status");--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD CONSTRAINT "creative_process_disclosures_revision_author_check" CHECK (nullif(btrim("creative_process_disclosures"."revision_author_name"), '') is not null
        and position('@' in "creative_process_disclosures"."revision_author_email") > 1
        and nullif(btrim("creative_process_disclosures"."revision_reason"), '') is not null);--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD CONSTRAINT "creative_process_disclosures_lyrics_check" CHECK (not "creative_process_disclosures"."lyrics_used" or nullif(btrim("creative_process_disclosures"."lyrics_details"), '') is not null);--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD CONSTRAINT "creative_process_disclosures_voice_clone_check" CHECK (not "creative_process_disclosures"."voice_clone_used" or nullif(btrim("creative_process_disclosures"."voice_clone_details"), '') is not null);--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD CONSTRAINT "creative_process_disclosures_samples_check" CHECK (not "creative_process_disclosures"."samples_used" or nullif(btrim("creative_process_disclosures"."sample_details"), '') is not null);--> statement-breakpoint
ALTER TABLE "provenance_evidence" ADD CONSTRAINT "provenance_evidence_filename_check" CHECK (nullif(btrim("provenance_evidence"."original_filename"), '') is not null);--> statement-breakpoint
ALTER TABLE "provenance_evidence" ADD CONSTRAINT "provenance_evidence_object_key_check" CHECK ("provenance_evidence"."object_key" !~* '^https?://' and "provenance_evidence"."object_key" like 'private/evidence/%' and nullif(btrim("provenance_evidence"."object_key"), '') is not null);--> statement-breakpoint
ALTER TABLE "provenance_records" ADD CONSTRAINT "provenance_records_revision_author_check" CHECK (nullif(btrim("provenance_records"."revision_author_name"), '') is not null
        and position('@' in "provenance_records"."revision_author_email") > 1
        and nullif(btrim("provenance_records"."revision_reason"), '') is not null);--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD CONSTRAINT "rights_declarations_revision_author_check" CHECK (nullif(btrim("rights_declarations"."revision_author_name"), '') is not null
        and position('@' in "rights_declarations"."revision_author_email") > 1
        and nullif(btrim("rights_declarations"."revision_reason"), '') is not null);--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD CONSTRAINT "rights_declarations_entitlement_check" CHECK (nullif(btrim("rights_declarations"."entitlement_statement"), '') is not null
        and nullif(btrim("rights_declarations"."public_summary"), '') is not null);--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD CONSTRAINT "rights_declarations_isrc_check" CHECK ("rights_declarations"."isrc" is null or "rights_declarations"."isrc" ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$');--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_public_reference_check" CHECK (nullif(btrim("submissions"."public_reference"), '') is not null);--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_check" CHECK (("submissions"."assigned_curator_id" is null and "submissions"."assigned_curator_email" is null and "submissions"."assigned_at" is null)
        or ("submissions"."assigned_curator_id" is not null and "submissions"."assigned_curator_email" is not null and "submissions"."assigned_at" is not null));--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_rejection_reason_check" CHECK ("submissions"."status" <> 'rejected' or nullif(btrim("submissions"."rejection_reason"), '') is not null);--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_acceptance_pins_check" CHECK ("submissions"."status" <> 'accepted' or (
        "submissions"."accepted_rights_declaration_id" is not null
        and "submissions"."accepted_creative_process_disclosure_id" is not null
        and "submissions"."accepted_provenance_record_id" is not null
      ));--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewed_timestamp_check" CHECK ("submissions"."status"::text not in ('eligibility_review', 'listening', 'clarification_requested', 'accepted', 'rejected') or "submissions"."reviewed_at" is not null);--> statement-breakpoint
CREATE TRIGGER "submission_invitations_set_updated_at" BEFORE UPDATE ON "submission_invitations"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "evidence_upload_sessions_set_updated_at" BEFORE UPDATE ON "evidence_upload_sessions"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
