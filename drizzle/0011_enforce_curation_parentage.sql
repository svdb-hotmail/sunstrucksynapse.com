CREATE FUNCTION "enforce_curation_review_submission_parent"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM rights_declarations
    WHERE id = NEW.rights_declaration_id AND submission_id = NEW.submission_id
  ) THEN
    RAISE EXCEPTION 'Pinned rights declaration must belong to the review submission.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM creative_process_disclosures
    WHERE id = NEW.creative_process_disclosure_id AND submission_id = NEW.submission_id
  ) THEN
    RAISE EXCEPTION 'Pinned process disclosure must belong to the review submission.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM provenance_records
    WHERE id = NEW.provenance_record_id AND submission_id = NEW.submission_id
  ) THEN
    RAISE EXCEPTION 'Pinned provenance record must belong to the review submission.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM submission_review_audio
    WHERE id = NEW.review_audio_id AND submission_id = NEW.submission_id
  ) THEN
    RAISE EXCEPTION 'Pinned review audio must belong to the review submission.';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "curation_reviews_submission_parent"
BEFORE INSERT OR UPDATE ON "curation_reviews"
FOR EACH ROW EXECUTE FUNCTION "enforce_curation_review_submission_parent"();
--> statement-breakpoint
CREATE FUNCTION "enforce_review_audio_upload_submission_parent"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM submission_audio_upload_sessions
    WHERE id = NEW.upload_session_id AND submission_id = NEW.submission_id
  ) THEN
    RAISE EXCEPTION 'Review audio upload session must belong to the same submission.';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "submission_review_audio_upload_parent"
BEFORE INSERT OR UPDATE ON "submission_review_audio"
FOR EACH ROW EXECUTE FUNCTION "enforce_review_audio_upload_submission_parent"();
--> statement-breakpoint
INSERT INTO "curation_outbox" (idempotency_key, kind, payload, available_at)
SELECT
  'review-audio-upload:' || sessions.id::text || ':staging-cleanup',
  'review_audio_staging_cleanup',
  jsonb_build_object('uploadSessionId', sessions.id),
  sessions.expires_at
FROM "submission_audio_upload_sessions" sessions
ON CONFLICT (idempotency_key) DO NOTHING;
