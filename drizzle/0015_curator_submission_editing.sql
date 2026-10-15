CREATE TABLE "submission_editorial_artwork" (
	"submission_id" uuid PRIMARY KEY NOT NULL,
	"artwork_asset_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "submission_editorial_artwork" ADD CONSTRAINT "submission_editorial_artwork_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_editorial_artwork" ADD CONSTRAINT "submission_editorial_artwork_artwork_asset_id_artwork_assets_id_fk" FOREIGN KEY ("artwork_asset_id") REFERENCES "public"."artwork_assets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Audio preparation is independent of artwork; publication still requires both.
CREATE OR REPLACE FUNCTION protect_release_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preparation history must be retained.'; END IF;
  IF TG_OP='INSERT' AND (NEW.status<>'queued' OR NEW.attempts<>0 OR NEW.output_object_key IS NOT NULL OR NEW.lease_token IS NOT NULL) THEN RAISE EXCEPTION 'Preparation must start in the queue.'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status='ready' OR ROW(NEW.track_id,NEW.review_id,NEW.source_audio_id,NEW.profile) IS DISTINCT FROM ROW(OLD.track_id,OLD.review_id,OLD.source_audio_id,OLD.profile) THEN RAISE EXCEPTION 'Preparation source and completed outputs are immutable.'; END IF;
    IF NEW.cover_id IS DISTINCT FROM OLD.cover_id AND NOT (OLD.cover_id IS NULL AND NEW.cover_id IS NOT NULL AND OLD.status in ('queued','failed')) THEN RAISE EXCEPTION 'Accepted cover is immutable.'; END IF;
    IF NEW.status='ready' AND (OLD.status<>'processing' OR OLD.lease_token IS NULL OR OLD.lease_expires_at<=now() OR NEW.output_object_key IS DISTINCT FROM 'private/streaming-preparation/'||NEW.id||'/'||OLD.lease_token||'.mp3') THEN RAISE EXCEPTION 'Output must be sealed under the current lease.'; END IF;
  END IF;
  IF NEW.profile<>'sunsyn-mp3-320k-44100-stereo-v1' OR NOT EXISTS(select 1 from curation_reviews r join submissions s on s.id=r.submission_id
    where r.id=NEW.review_id and r.review_audio_id=NEW.source_audio_id and r.final_grade in ('A','B')
      and s.status='accepted' and s.resulting_track_id=NEW.track_id
      and r.rights_declaration_id=s.accepted_rights_declaration_id
      and r.creative_process_disclosure_id=s.accepted_creative_process_disclosure_id
      and r.provenance_record_id=s.accepted_provenance_record_id) THEN RAISE EXCEPTION 'Preparation requires the exact accepted review and source.'; END IF;
  IF NEW.cover_id IS NOT NULL AND NOT EXISTS(select 1 from curation_reviews r join submission_cover_selections sc on sc.submission_id=r.submission_id
    where r.id=NEW.review_id and sc.cover_id=NEW.cover_id and submission_may_use_cover(r.submission_id,NEW.cover_id)) THEN RAISE EXCEPTION 'Preparation cover must be selected by the reviewed artist.'; END IF;
  RETURN NEW;
END; $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION require_prepared_stream_on_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lifecycle_status='published' AND OLD.lifecycle_status<>'published' AND EXISTS(select 1 from release_preparation_jobs where track_id=NEW.id) AND NOT EXISTS(
    select 1 from release_preparation_jobs j join audio_assets a on a.track_id=j.track_id and a.object_key=j.output_object_key and a.checksum_sha256=j.output_checksum
    where j.track_id=NEW.id and j.status='ready' and j.profile='sunsyn-mp3-320k-44100-stereo-v1'
      and a.scope='publishable_derivative' and a.status='ready' and a.is_primary
  ) THEN RAISE EXCEPTION 'Publication requires the verified standard streaming derivative.'; END IF;
  RETURN NEW;
END; $$;

--> statement-breakpoint
CREATE FUNCTION protect_editorial_artwork() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Keep curator artwork history.'; END IF;
  IF TG_OP='UPDATE' AND OLD.submission_id<>NEW.submission_id THEN RAISE EXCEPTION 'Artwork parent is immutable.'; END IF;
  IF NOT EXISTS(select 1 from submissions s left join tracks t on t.id=s.resulting_track_id left join releases r on r.id=t.release_id
    where s.id=NEW.submission_id and s.status not in ('rejected','withdrawn')
      and (s.resulting_track_id is null or (t.lifecycle_status in ('draft','in_review') and r.lifecycle_status in ('draft','in_review'))) FOR UPDATE OF s) THEN
    RAISE EXCEPTION 'Curator artwork requires an editable, unpublished submission.';
  END IF;
  IF NOT EXISTS(select 1 from artwork_assets a where a.id=NEW.artwork_asset_id and a.storage_provider='r2' and a.status='ready'
    and a.scope='publishable_derivative' and a.mime_type in ('image/png','image/jpeg','image/webp','image/avif')
    and a.byte_size between 1 and 20971520 and a.width between 1400 and 10000 and a.width=a.height) THEN
    RAISE EXCEPTION 'Curator artwork must be a verified square cover.';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER submission_editorial_artwork_guard BEFORE INSERT OR UPDATE OR DELETE ON submission_editorial_artwork FOR EACH ROW EXECUTE FUNCTION protect_editorial_artwork();
--> statement-breakpoint
CREATE FUNCTION keep_editorial_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.actor_role='curator' AND OLD.metadata->>'kind' in ('curator_metadata','curator_artwork') THEN
    RAISE EXCEPTION 'Curator corrections are append-only.';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
--> statement-breakpoint
CREATE TRIGGER submission_editorial_activity_immutable BEFORE UPDATE OR DELETE ON submission_activities FOR EACH ROW EXECUTE FUNCTION keep_editorial_activity();
