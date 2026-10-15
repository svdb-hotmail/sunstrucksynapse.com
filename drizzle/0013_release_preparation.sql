
CREATE TABLE "release_preparation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"source_audio_id" uuid NOT NULL,
	"cover_id" uuid,
	"profile" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"output_object_key" text,
	"output_checksum" text,
	"output_byte_size" bigint,
	"output_duration_ms" integer,
	"sample_rate" integer,
	"channels" integer,
	"bit_rate" integer,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_preparation_status_check" CHECK ("release_preparation_jobs"."status" in ('queued','processing','ready','failed')),
	CONSTRAINT "release_preparation_ready_check" CHECK ("release_preparation_jobs"."status" <> 'ready' or ("release_preparation_jobs"."output_object_key" is not null and "release_preparation_jobs"."output_checksum" is not null and "release_preparation_jobs"."output_checksum" ~ '^[0-9a-f]{64}$' and "release_preparation_jobs"."output_byte_size" is not null and "release_preparation_jobs"."output_byte_size" > 0 and "release_preparation_jobs"."output_duration_ms" is not null and "release_preparation_jobs"."output_duration_ms" > 0 and "release_preparation_jobs"."sample_rate" is not null and "release_preparation_jobs"."sample_rate" = 44100 and "release_preparation_jobs"."channels" is not null and "release_preparation_jobs"."channels" = 2 and "release_preparation_jobs"."bit_rate" is not null and "release_preparation_jobs"."bit_rate" = 320000))
);
--> statement-breakpoint
CREATE TABLE "submission_cover_selections" (
	"submission_id" uuid PRIMARY KEY NOT NULL,
	"cover_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_cover_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"rights_statement" text NOT NULL,
	"rights_acknowledged_at" timestamp with time zone NOT NULL,
	"staging_object_key" text NOT NULL,
	"object_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_cover_size_check" CHECK ("submission_cover_uploads"."byte_size" between 1 and 20971520),
	CONSTRAINT "submission_cover_dimensions_check" CHECK ("submission_cover_uploads"."width" between 1400 and 10000 and "submission_cover_uploads"."width" = "submission_cover_uploads"."height"),
	CONSTRAINT "submission_cover_hash_check" CHECK ("submission_cover_uploads"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "submission_cover_status_check" CHECK ("submission_cover_uploads"."status" in ('pending','finalizing','ready','failed')),
	CONSTRAINT "submission_cover_ready_check" CHECK ("submission_cover_uploads"."status" <> 'ready' or ("submission_cover_uploads"."object_key" is not null and "submission_cover_uploads"."finalized_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "submission_release_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_email" text NOT NULL,
	"artist_name" text NOT NULL,
	"title" text NOT NULL,
	"artist_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"origin_submission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "genres" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "release_preparation_jobs" ADD CONSTRAINT "release_preparation_jobs_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_preparation_jobs" ADD CONSTRAINT "release_preparation_jobs_review_id_curation_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."curation_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_preparation_jobs" ADD CONSTRAINT "release_preparation_jobs_source_audio_id_submission_review_audio_id_fk" FOREIGN KEY ("source_audio_id") REFERENCES "public"."submission_review_audio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_preparation_jobs" ADD CONSTRAINT "release_preparation_jobs_cover_id_submission_cover_uploads_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."submission_cover_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_cover_selections" ADD CONSTRAINT "submission_cover_selections_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_cover_selections" ADD CONSTRAINT "submission_cover_selections_cover_id_submission_cover_uploads_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."submission_cover_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_cover_uploads" ADD CONSTRAINT "submission_cover_uploads_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_release_projects" ADD CONSTRAINT "submission_release_projects_origin_submission_id_submissions_id_fk" FOREIGN KEY ("origin_submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "release_preparation_track_unique" ON "release_preparation_jobs" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_preparation_review_unique" ON "release_preparation_jobs" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "release_preparation_pending_idx" ON "release_preparation_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "submission_cover_uploads_submission_idx" ON "submission_cover_uploads" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_release_projects_origin_unique" ON "submission_release_projects" USING btree ("origin_submission_id");--> statement-breakpoint
CREATE INDEX "submission_release_projects_owner_idx" ON "submission_release_projects" USING btree ("owner_email");
--> statement-breakpoint
UPDATE tracks SET genres=ARRAY[genre] WHERE genre is not null and btrim(genre)<>'' and cardinality(genres)=0;
--> statement-breakpoint
CREATE FUNCTION submission_may_use_cover(sid uuid,cid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  select exists(select 1 from submission_cover_uploads c join submissions target on target.id=sid
    join submissions source on source.id=c.submission_id
    join submission_invitations ti on ti.id=target.invitation_id
    join submission_invitations si on si.id=source.invitation_id
    where c.id=cid and c.status='ready' and (
      c.submission_id=sid or exists(select 1 from submission_release_projects p
        where p.id::text=target.release_details->>'albumProjectId' and p.id::text=source.release_details->>'albumProjectId'
          and target.release_details->>'kind'='album' and source.release_details->>'kind'='album'
          and p.owner_email=lower(ti.invitee_email) and p.owner_email=lower(si.invitee_email)
          and lower(p.artist_name)=lower(target.artist_details->>'displayName')
          and lower(p.artist_name)=lower(source.artist_details->>'displayName'))))
$$;
--> statement-breakpoint
CREATE FUNCTION protect_submission_cover() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'pending' OR NEW.object_key IS NOT NULL OR NEW.rights_statement='' THEN RAISE EXCEPTION 'Cover must start as an artist-authorized upload.'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' OR OLD.status='ready' OR ROW(NEW.submission_id,NEW.filename,NEW.mime_type,NEW.checksum_sha256,NEW.byte_size,NEW.width,NEW.height,NEW.staging_object_key,NEW.expires_at,NEW.rights_statement,NEW.rights_acknowledged_at) IS DISTINCT FROM ROW(OLD.submission_id,OLD.filename,OLD.mime_type,OLD.checksum_sha256,OLD.byte_size,OLD.width,OLD.height,OLD.staging_object_key,OLD.expires_at,OLD.rights_statement,OLD.rights_acknowledged_at) THEN
    RAISE EXCEPTION 'Submitted cover metadata is immutable.';
  END IF;
  IF NEW.status='ready' AND (OLD.status<>'finalizing' OR OLD.lease_token IS NULL OR OLD.lease_expires_at<=now() OR NEW.object_key IS DISTINCT FROM 'private/submission-covers/final/'||NEW.id||'/'||OLD.lease_token) THEN RAISE EXCEPTION 'Cover must be sealed by its current lease.'; END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER submission_cover_immutable BEFORE INSERT OR UPDATE OR DELETE ON submission_cover_uploads FOR EACH ROW EXECUTE FUNCTION protect_submission_cover();
--> statement-breakpoint
CREATE FUNCTION protect_submission_cover_selection() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  sid=CASE WHEN TG_OP='DELETE' THEN OLD.submission_id ELSE NEW.submission_id END;
  IF TG_OP='UPDATE' AND OLD.submission_id<>NEW.submission_id THEN RAISE EXCEPTION 'Cover parent is immutable.'; END IF;
  IF NOT EXISTS(select 1 from submissions s where s.id=sid and (
    s.status in ('draft','clarification_requested') or (
      s.status='accepted' and TG_OP='INSERT' and not exists(select 1 from submission_cover_selections sc where sc.submission_id=s.id)
      and exists(select 1 from tracks t where t.id=s.resulting_track_id and t.lifecycle_status in ('draft','in_review')))) for update) THEN RAISE EXCEPTION 'Cover selection is locked after submission.'; END IF;
  IF TG_OP<>'DELETE' AND NOT submission_may_use_cover(NEW.submission_id,NEW.cover_id) THEN RAISE EXCEPTION 'Cover requires this submission or its verified artist album.'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
--> statement-breakpoint
CREATE TRIGGER submission_cover_selection_guard BEFORE INSERT OR UPDATE OR DELETE ON submission_cover_selections FOR EACH ROW EXECUTE FUNCTION protect_submission_cover_selection();
--> statement-breakpoint
CREATE FUNCTION protect_release_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preparation history must be retained.'; END IF;
  IF TG_OP='INSERT' AND (NEW.status<>'queued' OR NEW.attempts<>0 OR NEW.output_object_key IS NOT NULL OR NEW.lease_token IS NOT NULL) THEN RAISE EXCEPTION 'Preparation must start in the queue.'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status='ready' OR ROW(NEW.track_id,NEW.review_id,NEW.source_audio_id,NEW.profile) IS DISTINCT FROM ROW(OLD.track_id,OLD.review_id,OLD.source_audio_id,OLD.profile) THEN RAISE EXCEPTION 'Preparation source and completed outputs are immutable.'; END IF;
    IF NEW.cover_id IS DISTINCT FROM OLD.cover_id AND NOT (OLD.cover_id IS NULL AND NEW.cover_id IS NOT NULL AND OLD.status in ('queued','failed')) THEN RAISE EXCEPTION 'Accepted cover is immutable.'; END IF;
    IF NEW.status='ready' AND (OLD.status<>'processing' OR OLD.lease_token IS NULL OR OLD.lease_expires_at<=now() OR NEW.output_object_key IS DISTINCT FROM 'private/streaming-preparation/'||NEW.id||'/'||OLD.lease_token||'.mp3' OR NEW.cover_id IS NULL) THEN RAISE EXCEPTION 'Output must be sealed under the current lease.'; END IF;
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
CREATE TRIGGER release_preparation_integrity BEFORE INSERT OR UPDATE OR DELETE ON release_preparation_jobs FOR EACH ROW EXECUTE FUNCTION protect_release_preparation();
--> statement-breakpoint
CREATE FUNCTION require_prepared_stream_on_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lifecycle_status='published' AND OLD.lifecycle_status<>'published' AND EXISTS(select 1 from release_preparation_jobs where track_id=NEW.id) AND NOT EXISTS(
    select 1 from release_preparation_jobs j join audio_assets a on a.track_id=j.track_id and a.object_key=j.output_object_key and a.checksum_sha256=j.output_checksum
    where j.track_id=NEW.id and j.status='ready' and j.cover_id is not null and j.profile='sunsyn-mp3-320k-44100-stereo-v1'
      and a.scope='publishable_derivative' and a.status='ready' and a.is_primary
  ) THEN RAISE EXCEPTION 'Publication requires the verified standard streaming derivative.'; END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER track_preparation_publication_gate BEFORE UPDATE OF lifecycle_status ON tracks FOR EACH ROW EXECUTE FUNCTION require_prepared_stream_on_publication();
--> statement-breakpoint
INSERT INTO release_preparation_jobs(track_id,review_id,source_audio_id,cover_id,profile)
SELECT s.resulting_track_id,r.id,r.review_audio_id,null,'sunsyn-mp3-320k-44100-stereo-v1'
FROM submissions s JOIN curation_reviews r ON r.submission_id=s.id JOIN tracks t ON t.id=s.resulting_track_id
WHERE s.status='accepted' AND s.resulting_track_id IS NOT NULL AND r.final_grade in ('A','B') AND t.lifecycle_status in ('draft','in_review')
  AND r.rights_declaration_id=s.accepted_rights_declaration_id AND r.creative_process_disclosure_id=s.accepted_creative_process_disclosure_id AND r.provenance_record_id=s.accepted_provenance_record_id
ON CONFLICT(track_id) DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION protect_album_project() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR ROW(NEW.id,NEW.owner_email,NEW.artist_id,NEW.release_id,NEW.origin_submission_id) IS DISTINCT FROM ROW(OLD.id,OLD.owner_email,OLD.artist_id,OLD.release_id,OLD.origin_submission_id)
    OR EXISTS(select 1 from releases where id=OLD.release_id)
    OR EXISTS(select 1 from submissions s where s.release_details->>'albumProjectId'=OLD.id::text and s.id<>OLD.origin_submission_id) THEN
    RAISE EXCEPTION 'Artist album identity is immutable once shared or accepted.';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER submission_release_project_immutable BEFORE UPDATE OR DELETE ON submission_release_projects FOR EACH ROW EXECUTE FUNCTION protect_album_project();
--> statement-breakpoint
CREATE FUNCTION guard_album_track_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE release_status catalogue_lifecycle;
BEGIN
  IF EXISTS(select 1 from submission_release_projects where release_id=NEW.release_id) THEN
    SELECT lifecycle_status INTO release_status FROM releases WHERE id=NEW.release_id FOR UPDATE;
    IF release_status NOT IN ('draft','in_review') THEN RAISE EXCEPTION 'Album has already been published; no late tracks can be accepted into it.'; END IF;
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER album_track_insert_gate BEFORE INSERT ON tracks FOR EACH ROW EXECUTE FUNCTION guard_album_track_insert();
--> statement-breakpoint
CREATE FUNCTION guard_submission_album_choice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status NOT IN ('draft','clarification_requested') AND ROW(NEW.artist_details,NEW.release_details,NEW.track_details,NEW.invitation_id) IS DISTINCT FROM ROW(OLD.artist_details,OLD.release_details,OLD.track_details,OLD.invitation_id) THEN
    RAISE EXCEPTION 'Submitted release details are immutable outside artist clarification.';
  END IF;
  IF nullif(NEW.release_details->>'albumProjectId','') IS NOT NULL AND NOT EXISTS(
    select 1 from submission_release_projects p join submission_invitations i on i.id=NEW.invitation_id
    left join releases r on r.id=p.release_id
    where p.id::text=NEW.release_details->>'albumProjectId' and p.owner_email=lower(i.invitee_email)
      and lower(p.artist_name)=lower(NEW.artist_details->>'displayName') and NEW.release_details->>'kind'='album'
      and (r.id is null or r.lifecycle_status in ('draft','in_review'))
  ) THEN RAISE EXCEPTION 'Album must belong to this verified invitation and artist, and be unpublished.'; END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER submission_album_choice_gate BEFORE INSERT OR UPDATE OF artist_details,release_details,track_details,invitation_id ON submissions FOR EACH ROW EXECUTE FUNCTION guard_submission_album_choice();

--> statement-breakpoint
CREATE UNIQUE INDEX "release_preparation_one_processing" ON "release_preparation_jobs" ("status") WHERE "release_preparation_jobs"."status" = 'processing';
