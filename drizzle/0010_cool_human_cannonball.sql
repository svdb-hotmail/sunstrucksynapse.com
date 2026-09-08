CREATE TABLE "curation_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'finalized' NOT NULL,
	"eligibility" text NOT NULL,
	"artistic_quality" integer NOT NULL,
	"originality_intent" integer NOT NULL,
	"production_readiness" integer NOT NULL,
	"editorial_fit" integer NOT NULL,
	"final_grade" text NOT NULL,
	"rationale" text NOT NULL,
	"curator_id" text NOT NULL,
	"curator_email" text NOT NULL,
	"rights_declaration_id" uuid NOT NULL,
	"creative_process_disclosure_id" uuid NOT NULL,
	"provenance_record_id" uuid NOT NULL,
	"review_audio_id" uuid NOT NULL,
	"finalized_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curation_reviews_status_check" CHECK ("curation_reviews"."status" = 'finalized'),
	CONSTRAINT "curation_reviews_eligibility_check" CHECK ("curation_reviews"."eligibility" = 'eligible'),
	CONSTRAINT "curation_reviews_scores_check" CHECK ("curation_reviews"."artistic_quality" between 1 and 5
        and "curation_reviews"."originality_intent" between 1 and 5
        and "curation_reviews"."production_readiness" between 1 and 5
        and "curation_reviews"."editorial_fit" between 1 and 5),
	CONSTRAINT "curation_reviews_grade_check" CHECK ("curation_reviews"."final_grade" in ('A', 'B', 'C')),
	CONSTRAINT "curation_reviews_identity_check" CHECK (nullif(btrim("curation_reviews"."curator_id"), '') is not null and position('@' in "curation_reviews"."curator_email") > 1),
	CONSTRAINT "curation_reviews_rationale_check" CHECK (nullif(btrim("curation_reviews"."rationale"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "submission_audio_upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"staging_object_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"duration_ms" integer NOT NULL,
	"codec" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_audio_upload_sessions_key_check" CHECK ("submission_audio_upload_sessions"."staging_object_key" like 'private/review-audio/staging/%'),
	CONSTRAINT "submission_audio_upload_sessions_metadata_check" CHECK (nullif(btrim("submission_audio_upload_sessions"."original_filename"), '') is not null
        and "submission_audio_upload_sessions"."mime_type" in ('audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/flac')
        and "submission_audio_upload_sessions"."checksum_sha256" ~ '^[0-9a-f]{64}$'
        and "submission_audio_upload_sessions"."byte_size" between 1 and 524288000
        and "submission_audio_upload_sessions"."duration_ms" between 1 and 86400000
        and nullif(btrim("submission_audio_upload_sessions"."codec"), '') is not null),
	CONSTRAINT "submission_audio_upload_sessions_status_check" CHECK ("submission_audio_upload_sessions"."status" in ('pending', 'finalizing', 'completed', 'abandoned', 'failed')),
	CONSTRAINT "submission_audio_upload_sessions_lease_check" CHECK (("submission_audio_upload_sessions"."status" = 'finalizing') = ("submission_audio_upload_sessions"."lease_token" is not null and "submission_audio_upload_sessions"."lease_expires_at" is not null)),
	CONSTRAINT "submission_audio_upload_sessions_completion_check" CHECK (("submission_audio_upload_sessions"."status" = 'completed') = ("submission_audio_upload_sessions"."completed_at" is not null)),
	CONSTRAINT "submission_audio_upload_sessions_failure_check" CHECK ("submission_audio_upload_sessions"."failure_code" is null or "submission_audio_upload_sessions"."failure_code" ~ '^[A-Z][A-Z0-9_]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "submission_review_audio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"upload_session_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"object_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"duration_ms" integer NOT NULL,
	"codec" text NOT NULL,
	"finalized_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_review_audio_key_check" CHECK ("submission_review_audio"."object_key" like 'private/review-audio/final/%'),
	CONSTRAINT "submission_review_audio_version_check" CHECK ("submission_review_audio"."version" > 0),
	CONSTRAINT "submission_review_audio_metadata_check" CHECK ("submission_review_audio"."checksum_sha256" ~ '^[0-9a-f]{64}$' and "submission_review_audio"."byte_size" > 0 and "submission_review_audio"."duration_ms" > 0)
);
--> statement-breakpoint
CREATE TABLE "submission_review_audio_selections" (
	"submission_id" uuid PRIMARY KEY NOT NULL,
	"audio_id" uuid NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "curation_reviews" ADD CONSTRAINT "curation_reviews_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_reviews" ADD CONSTRAINT "curation_reviews_rights_declaration_id_rights_declarations_id_fk" FOREIGN KEY ("rights_declaration_id") REFERENCES "public"."rights_declarations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_reviews" ADD CONSTRAINT "curation_reviews_creative_process_disclosure_id_creative_process_disclosures_id_fk" FOREIGN KEY ("creative_process_disclosure_id") REFERENCES "public"."creative_process_disclosures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_reviews" ADD CONSTRAINT "curation_reviews_provenance_record_id_provenance_records_id_fk" FOREIGN KEY ("provenance_record_id") REFERENCES "public"."provenance_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_reviews" ADD CONSTRAINT "curation_reviews_review_audio_id_submission_review_audio_id_fk" FOREIGN KEY ("review_audio_id") REFERENCES "public"."submission_review_audio"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_audio_upload_sessions" ADD CONSTRAINT "submission_audio_upload_sessions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_review_audio" ADD CONSTRAINT "submission_review_audio_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_review_audio" ADD CONSTRAINT "submission_review_audio_upload_session_id_submission_audio_upload_sessions_id_fk" FOREIGN KEY ("upload_session_id") REFERENCES "public"."submission_audio_upload_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_review_audio_selections" ADD CONSTRAINT "submission_review_audio_selections_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_review_audio_selections" ADD CONSTRAINT "submission_review_audio_selections_audio_id_submission_review_audio_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."submission_review_audio"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "curation_reviews_submission_version_unique" ON "curation_reviews" USING btree ("submission_id","version");--> statement-breakpoint
CREATE INDEX "curation_reviews_grade_idx" ON "curation_reviews" USING btree ("final_grade","finalized_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_audio_upload_sessions_staging_key_unique" ON "submission_audio_upload_sessions" USING btree ("staging_object_key");--> statement-breakpoint
CREATE INDEX "submission_audio_upload_sessions_cleanup_idx" ON "submission_audio_upload_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "submission_audio_upload_sessions_submission_idx" ON "submission_audio_upload_sessions" USING btree ("submission_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_review_audio_upload_session_unique" ON "submission_review_audio" USING btree ("upload_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_review_audio_object_key_unique" ON "submission_review_audio" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_review_audio_submission_version_unique" ON "submission_review_audio" USING btree ("submission_id","version");--> statement-breakpoint
CREATE INDEX "submission_review_audio_submission_idx" ON "submission_review_audio" USING btree ("submission_id","finalized_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_review_audio_selections_audio_unique" ON "submission_review_audio_selections" USING btree ("audio_id");
--> statement-breakpoint
CREATE FUNCTION "protect_immutable_curation_records"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Finalized curation records are immutable.';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "curation_reviews_immutable"
BEFORE UPDATE OR DELETE ON "curation_reviews"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_curation_records"();--> statement-breakpoint
CREATE TRIGGER "submission_review_audio_immutable"
BEFORE UPDATE OR DELETE ON "submission_review_audio"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_curation_records"();--> statement-breakpoint
CREATE FUNCTION "protect_completed_audio_upload_session"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed review-audio upload sessions are immutable.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "submission_audio_upload_sessions_protect_completed"
BEFORE UPDATE OR DELETE ON "submission_audio_upload_sessions"
FOR EACH ROW EXECUTE FUNCTION "protect_completed_audio_upload_session"();--> statement-breakpoint
CREATE TRIGGER "submission_audio_upload_sessions_set_updated_at"
BEFORE UPDATE ON "submission_audio_upload_sessions"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "submission_review_audio_selections_set_updated_at"
BEFORE UPDATE ON "submission_review_audio_selections"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE FUNCTION "enforce_review_audio_selection_parent"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM submission_review_audio
    WHERE id = NEW.audio_id AND submission_id = NEW.submission_id
  ) THEN
    RAISE EXCEPTION 'Selected review audio must belong to the same submission.';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "submission_review_audio_selections_parent"
BEFORE INSERT OR UPDATE ON "submission_review_audio_selections"
FOR EACH ROW EXECUTE FUNCTION "enforce_review_audio_selection_parent"();
