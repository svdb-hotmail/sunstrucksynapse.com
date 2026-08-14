CREATE TYPE "public"."artwork_role" AS ENUM('primary', 'gallery', 'avatar', 'banner');--> statement-breakpoint
CREATE TYPE "public"."asset_scope" AS ENUM('private_master', 'publishable_derivative');--> statement-breakpoint
CREATE TYPE "public"."attestation_status" AS ENUM('draft', 'attested', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."authority_basis" AS ENUM('original_author', 'licensed', 'public_domain', 'other');--> statement-breakpoint
CREATE TYPE "public"."catalogue_lifecycle" AS ENUM('draft', 'in_review', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."provenance_source_type" AS ENUM('original_recording', 'licensed_material', 'public_domain', 'generated_material', 'other');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'submitted', 'under_review', 'changes_requested', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."versioned_record_status" AS ENUM('draft', 'finalized', 'superseded');--> statement-breakpoint
CREATE TABLE "artist_artwork_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"artwork_asset_id" uuid NOT NULL,
	"role" "artwork_role" DEFAULT 'gallery' NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_artwork_assets_position_unique" UNIQUE("artist_id","role","position"),
	CONSTRAINT "artist_artwork_assets_asset_unique" UNIQUE("artist_id","artwork_asset_id","role"),
	CONSTRAINT "artist_artwork_assets_position_check" CHECK ("artist_artwork_assets"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"biography" text,
	"lifecycle_status" "catalogue_lifecycle" DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_slug_check" CHECK ("artists"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "artists_lifecycle_check" CHECK ((
    ("artists"."lifecycle_status" in ('draft', 'in_review') and "artists"."scheduled_for" is null and "artists"."published_at" is null and "artists"."archived_at" is null)
    or ("artists"."lifecycle_status" = 'scheduled' and "artists"."scheduled_for" is not null and "artists"."published_at" is null and "artists"."archived_at" is null)
    or ("artists"."lifecycle_status" = 'published' and "artists"."published_at" is not null and "artists"."archived_at" is null)
    or ("artists"."lifecycle_status" = 'archived' and "artists"."archived_at" is not null)
  )),
	CONSTRAINT "artists_publication_order_check" CHECK ("artists"."published_at" is null or "artists"."scheduled_for" is null or "artists"."published_at" >= "artists"."scheduled_for")
);
--> statement-breakpoint
CREATE TABLE "artwork_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_key" text NOT NULL,
	"scope" "asset_scope" NOT NULL,
	"mime_type" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artwork_assets_checksum_sha256_check" CHECK ("artwork_assets"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "artwork_assets_byte_size_check" CHECK ("artwork_assets"."byte_size" > 0),
	CONSTRAINT "artwork_assets_dimensions_check" CHECK (("artwork_assets"."width" is null and "artwork_assets"."height" is null) or ("artwork_assets"."width" > 0 and "artwork_assets"."height" > 0))
);
--> statement-breakpoint
CREATE TABLE "audio_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"scope" "asset_scope" NOT NULL,
	"mime_type" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"duration_ms" integer NOT NULL,
	"codec" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audio_assets_checksum_sha256_check" CHECK ("audio_assets"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "audio_assets_byte_size_check" CHECK ("audio_assets"."byte_size" > 0),
	CONSTRAINT "audio_assets_duration_check" CHECK ("audio_assets"."duration_ms" > 0)
);
--> statement-breakpoint
CREATE TABLE "release_artist_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"credited_as" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_artist_credits_position_unique" UNIQUE("release_id","position"),
	CONSTRAINT "release_artist_credits_artist_unique" UNIQUE("release_id","artist_id"),
	CONSTRAINT "release_artist_credits_position_check" CHECK ("release_artist_credits"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "release_artwork_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"artwork_asset_id" uuid NOT NULL,
	"role" "artwork_role" DEFAULT 'gallery' NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_artwork_assets_position_unique" UNIQUE("release_id","role","position"),
	CONSTRAINT "release_artwork_assets_asset_unique" UNIQUE("release_id","artwork_asset_id","role"),
	CONSTRAINT "release_artwork_assets_position_check" CHECK ("release_artwork_assets"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"release_date" timestamp with time zone,
	"lifecycle_status" "catalogue_lifecycle" DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "releases_slug_check" CHECK ("releases"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "releases_lifecycle_check" CHECK ((
    ("releases"."lifecycle_status" in ('draft', 'in_review') and "releases"."scheduled_for" is null and "releases"."published_at" is null and "releases"."archived_at" is null)
    or ("releases"."lifecycle_status" = 'scheduled' and "releases"."scheduled_for" is not null and "releases"."published_at" is null and "releases"."archived_at" is null)
    or ("releases"."lifecycle_status" = 'published' and "releases"."published_at" is not null and "releases"."archived_at" is null)
    or ("releases"."lifecycle_status" = 'archived' and "releases"."archived_at" is not null)
  )),
	CONSTRAINT "releases_publication_order_check" CHECK ("releases"."published_at" is null or "releases"."scheduled_for" is null or "releases"."published_at" >= "releases"."scheduled_for")
);
--> statement-breakpoint
CREATE TABLE "track_artist_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"credited_as" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_artist_credits_position_unique" UNIQUE("track_id","position"),
	CONSTRAINT "track_artist_credits_artist_unique" UNIQUE("track_id","artist_id"),
	CONSTRAINT "track_artist_credits_position_check" CHECK ("track_artist_credits"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"disc_number" integer DEFAULT 1 NOT NULL,
	"position" integer NOT NULL,
	"lifecycle_status" "catalogue_lifecycle" DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracks_release_slug_unique" UNIQUE("release_id","slug"),
	CONSTRAINT "tracks_release_order_unique" UNIQUE("release_id","disc_number","position"),
	CONSTRAINT "tracks_slug_check" CHECK ("tracks"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "tracks_order_check" CHECK ("tracks"."disc_number" > 0 and "tracks"."position" > 0),
	CONSTRAINT "tracks_lifecycle_check" CHECK ((
    ("tracks"."lifecycle_status" in ('draft', 'in_review') and "tracks"."scheduled_for" is null and "tracks"."published_at" is null and "tracks"."archived_at" is null)
    or ("tracks"."lifecycle_status" = 'scheduled' and "tracks"."scheduled_for" is not null and "tracks"."published_at" is null and "tracks"."archived_at" is null)
    or ("tracks"."lifecycle_status" = 'published' and "tracks"."published_at" is not null and "tracks"."archived_at" is null)
    or ("tracks"."lifecycle_status" = 'archived' and "tracks"."archived_at" is not null)
  )),
	CONSTRAINT "tracks_publication_order_check" CHECK ("tracks"."published_at" is null or "tracks"."scheduled_for" is null or "tracks"."published_at" >= "tracks"."scheduled_for")
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"track_id" uuid,
	"release_id" uuid,
	"position" integer NOT NULL,
	"annotation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_position_unique" UNIQUE("collection_id","position"),
	CONSTRAINT "collection_items_position_check" CHECK ("collection_items"."position" > 0),
	CONSTRAINT "collection_items_exactly_one_target_check" CHECK (num_nonnulls("collection_items"."track_id", "collection_items"."release_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "editorial_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"artwork_asset_id" uuid,
	"lifecycle_status" "catalogue_lifecycle" DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_collections_slug_check" CHECK ("editorial_collections"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "editorial_collections_lifecycle_check" CHECK ((
        ("editorial_collections"."lifecycle_status" in ('draft', 'in_review') and "editorial_collections"."scheduled_for" is null and "editorial_collections"."published_at" is null and "editorial_collections"."archived_at" is null)
        or ("editorial_collections"."lifecycle_status" = 'scheduled' and "editorial_collections"."scheduled_for" is not null and "editorial_collections"."published_at" is null and "editorial_collections"."archived_at" is null)
        or ("editorial_collections"."lifecycle_status" = 'published' and "editorial_collections"."published_at" is not null and "editorial_collections"."archived_at" is null)
        or ("editorial_collections"."lifecycle_status" = 'archived' and "editorial_collections"."archived_at" is not null)
      )),
	CONSTRAINT "editorial_collections_publication_order_check" CHECK ("editorial_collections"."published_at" is null or "editorial_collections"."scheduled_for" is null or "editorial_collections"."published_at" >= "editorial_collections"."scheduled_for")
);
--> statement-breakpoint
CREATE TABLE "creative_process_disclosures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid,
	"release_id" uuid,
	"track_id" uuid,
	"version" integer NOT NULL,
	"supersedes_id" uuid,
	"status" "versioned_record_status" DEFAULT 'draft' NOT NULL,
	"ai_used" boolean NOT NULL,
	"ai_use_description" text,
	"meaningful_human_contribution" text NOT NULL,
	"tools_and_systems" text[] NOT NULL,
	"source_material_context" text,
	"artist_summary" text NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creative_process_disclosures_parent_check" CHECK (num_nonnulls("creative_process_disclosures"."submission_id", "creative_process_disclosures"."release_id", "creative_process_disclosures"."track_id") = 1),
	CONSTRAINT "creative_process_disclosures_version_check" CHECK ("creative_process_disclosures"."version" > 0),
	CONSTRAINT "creative_process_disclosures_self_supersession_check" CHECK ("creative_process_disclosures"."supersedes_id" is null or "creative_process_disclosures"."supersedes_id" <> "creative_process_disclosures"."id"),
	CONSTRAINT "creative_process_disclosures_finalized_check" CHECK (("creative_process_disclosures"."status" = 'draft' and "creative_process_disclosures"."finalized_at" is null) or ("creative_process_disclosures"."status" in ('finalized', 'superseded') and "creative_process_disclosures"."finalized_at" is not null)),
	CONSTRAINT "creative_process_disclosures_ai_use_check" CHECK (not "creative_process_disclosures"."ai_used" or nullif(btrim("creative_process_disclosures"."ai_use_description"), '') is not null),
	CONSTRAINT "creative_process_disclosures_human_contribution_check" CHECK (nullif(btrim("creative_process_disclosures"."meaningful_human_contribution"), '') is not null),
	CONSTRAINT "creative_process_disclosures_artist_summary_check" CHECK (nullif(btrim("creative_process_disclosures"."artist_summary"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "provenance_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provenance_record_id" uuid NOT NULL,
	"storage_provider" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provenance_evidence_object_key_check" CHECK ("provenance_evidence"."object_key" !~* '^https?://' and nullif(btrim("provenance_evidence"."object_key"), '') is not null),
	CONSTRAINT "provenance_evidence_checksum_sha256_check" CHECK ("provenance_evidence"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "provenance_evidence_byte_size_check" CHECK ("provenance_evidence"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "provenance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid,
	"release_id" uuid,
	"track_id" uuid,
	"version" integer NOT NULL,
	"supersedes_id" uuid,
	"status" "versioned_record_status" DEFAULT 'draft' NOT NULL,
	"summary" text NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provenance_records_parent_check" CHECK (num_nonnulls("provenance_records"."submission_id", "provenance_records"."release_id", "provenance_records"."track_id") = 1),
	CONSTRAINT "provenance_records_version_check" CHECK ("provenance_records"."version" > 0),
	CONSTRAINT "provenance_records_self_supersession_check" CHECK ("provenance_records"."supersedes_id" is null or "provenance_records"."supersedes_id" <> "provenance_records"."id"),
	CONSTRAINT "provenance_records_finalized_check" CHECK (("provenance_records"."status" = 'draft' and "provenance_records"."finalized_at" is null) or ("provenance_records"."status" in ('finalized', 'superseded') and "provenance_records"."finalized_at" is not null)),
	CONSTRAINT "provenance_records_summary_check" CHECK (nullif(btrim("provenance_records"."summary"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "provenance_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provenance_record_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"source_type" "provenance_source_type" NOT NULL,
	"reference" text NOT NULL,
	"rights_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provenance_sources_reference_check" CHECK (nullif(btrim("provenance_sources"."reference"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "provenance_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provenance_record_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"process_type" text NOT NULL,
	"description" text NOT NULL,
	"occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provenance_steps_position_check" CHECK ("provenance_steps"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "rights_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid,
	"release_id" uuid,
	"track_id" uuid,
	"version" integer NOT NULL,
	"supersedes_id" uuid,
	"status" "attestation_status" DEFAULT 'draft' NOT NULL,
	"authority_basis" "authority_basis" NOT NULL,
	"authority_details" text,
	"contains_third_party_material" boolean DEFAULT false NOT NULL,
	"third_party_material_details" text,
	"restrictions" text,
	"attestation" text,
	"attested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rights_declarations_parent_check" CHECK (num_nonnulls("rights_declarations"."submission_id", "rights_declarations"."release_id", "rights_declarations"."track_id") = 1),
	CONSTRAINT "rights_declarations_version_check" CHECK ("rights_declarations"."version" > 0),
	CONSTRAINT "rights_declarations_self_supersession_check" CHECK ("rights_declarations"."supersedes_id" is null or "rights_declarations"."supersedes_id" <> "rights_declarations"."id"),
	CONSTRAINT "rights_declarations_attestation_check" CHECK (("rights_declarations"."status" = 'draft' and "rights_declarations"."attested_at" is null and "rights_declarations"."attestation" is null) or ("rights_declarations"."status" in ('attested', 'superseded') and "rights_declarations"."attested_at" is not null and nullif(btrim("rights_declarations"."attestation"), '') is not null)),
	CONSTRAINT "rights_declarations_third_party_check" CHECK (not "rights_declarations"."contains_third_party_material" or nullif(btrim("rights_declarations"."third_party_material_details"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_reference" text NOT NULL,
	"submitter_name" text NOT NULL,
	"submitter_email" text NOT NULL,
	"title" text NOT NULL,
	"status" "submission_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"resulting_release_id" uuid,
	"resulting_track_id" uuid,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_submitted_timestamp_check" CHECK (("submissions"."status" = 'draft' and "submissions"."submitted_at" is null) or ("submissions"."status" <> 'draft' and "submissions"."submitted_at" is not null)),
	CONSTRAINT "submissions_reviewed_timestamp_check" CHECK ("submissions"."status" not in ('changes_requested', 'accepted', 'rejected') or "submissions"."reviewed_at" is not null),
	CONSTRAINT "submissions_accepted_timestamp_check" CHECK (("submissions"."status" = 'accepted') = ("submissions"."accepted_at" is not null)),
	CONSTRAINT "submissions_rejected_timestamp_check" CHECK (("submissions"."status" = 'rejected') = ("submissions"."rejected_at" is not null)),
	CONSTRAINT "submissions_withdrawn_timestamp_check" CHECK (("submissions"."status" = 'withdrawn') = ("submissions"."withdrawn_at" is not null)),
	CONSTRAINT "submissions_resulting_catalogue_check" CHECK ((num_nonnulls("submissions"."resulting_release_id", "submissions"."resulting_track_id") = 0) or ("submissions"."status" = 'accepted'))
);
--> statement-breakpoint
ALTER TABLE "artist_artwork_assets" ADD CONSTRAINT "artist_artwork_assets_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_artwork_assets" ADD CONSTRAINT "artist_artwork_assets_artwork_asset_id_artwork_assets_id_fk" FOREIGN KEY ("artwork_asset_id") REFERENCES "public"."artwork_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_assets" ADD CONSTRAINT "audio_assets_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_artist_credits" ADD CONSTRAINT "release_artist_credits_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_artist_credits" ADD CONSTRAINT "release_artist_credits_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_artwork_assets" ADD CONSTRAINT "release_artwork_assets_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_artwork_assets" ADD CONSTRAINT "release_artwork_assets_artwork_asset_id_artwork_assets_id_fk" FOREIGN KEY ("artwork_asset_id") REFERENCES "public"."artwork_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artist_credits" ADD CONSTRAINT "track_artist_credits_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artist_credits" ADD CONSTRAINT "track_artist_credits_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_editorial_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."editorial_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_collections" ADD CONSTRAINT "editorial_collections_artwork_asset_id_artwork_assets_id_fk" FOREIGN KEY ("artwork_asset_id") REFERENCES "public"."artwork_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD CONSTRAINT "creative_process_disclosures_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD CONSTRAINT "creative_process_disclosures_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD CONSTRAINT "creative_process_disclosures_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_process_disclosures" ADD CONSTRAINT "creative_process_disclosures_supersedes_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."creative_process_disclosures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_evidence" ADD CONSTRAINT "provenance_evidence_provenance_record_id_provenance_records_id_fk" FOREIGN KEY ("provenance_record_id") REFERENCES "public"."provenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD CONSTRAINT "provenance_records_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD CONSTRAINT "provenance_records_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD CONSTRAINT "provenance_records_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_records" ADD CONSTRAINT "provenance_records_supersedes_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."provenance_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_sources" ADD CONSTRAINT "provenance_sources_provenance_record_id_provenance_records_id_fk" FOREIGN KEY ("provenance_record_id") REFERENCES "public"."provenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_steps" ADD CONSTRAINT "provenance_steps_provenance_record_id_provenance_records_id_fk" FOREIGN KEY ("provenance_record_id") REFERENCES "public"."provenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD CONSTRAINT "rights_declarations_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD CONSTRAINT "rights_declarations_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD CONSTRAINT "rights_declarations_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rights_declarations" ADD CONSTRAINT "rights_declarations_supersedes_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."rights_declarations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_resulting_release_id_releases_id_fk" FOREIGN KEY ("resulting_release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_resulting_track_id_tracks_id_fk" FOREIGN KEY ("resulting_track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_artwork_assets_artist_id_idx" ON "artist_artwork_assets" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "artist_artwork_assets_artwork_asset_id_idx" ON "artist_artwork_assets" USING btree ("artwork_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artists_slug_unique" ON "artists" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "artists_lifecycle_queue_idx" ON "artists" USING btree ("lifecycle_status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "artwork_assets_object_key_unique" ON "artwork_assets" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "artwork_assets_scope_idx" ON "artwork_assets" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_assets_object_key_unique" ON "audio_assets" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_assets_track_scope_primary_unique" ON "audio_assets" USING btree ("track_id","scope") WHERE "audio_assets"."is_primary";--> statement-breakpoint
CREATE INDEX "audio_assets_track_id_idx" ON "audio_assets" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "audio_assets_scope_idx" ON "audio_assets" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "release_artist_credits_release_id_idx" ON "release_artist_credits" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "release_artist_credits_artist_id_idx" ON "release_artist_credits" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "release_artwork_assets_release_id_idx" ON "release_artwork_assets" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "release_artwork_assets_artwork_asset_id_idx" ON "release_artwork_assets" USING btree ("artwork_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_slug_unique" ON "releases" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "releases_lifecycle_queue_idx" ON "releases" USING btree ("lifecycle_status","scheduled_for");--> statement-breakpoint
CREATE INDEX "track_artist_credits_track_id_idx" ON "track_artist_credits" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_artist_credits_artist_id_idx" ON "track_artist_credits" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "tracks_release_id_idx" ON "tracks" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "tracks_slug_idx" ON "tracks" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tracks_release_order_idx" ON "tracks" USING btree ("release_id","disc_number","position");--> statement-breakpoint
CREATE INDEX "tracks_lifecycle_queue_idx" ON "tracks" USING btree ("lifecycle_status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_track_unique" ON "collection_items" USING btree ("collection_id","track_id") WHERE "collection_items"."track_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_release_unique" ON "collection_items" USING btree ("collection_id","release_id") WHERE "collection_items"."release_id" is not null;--> statement-breakpoint
CREATE INDEX "collection_items_collection_order_idx" ON "collection_items" USING btree ("collection_id","position");--> statement-breakpoint
CREATE INDEX "collection_items_track_id_idx" ON "collection_items" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "collection_items_release_id_idx" ON "collection_items" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_collections_slug_unique" ON "editorial_collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "editorial_collections_artwork_asset_id_idx" ON "editorial_collections" USING btree ("artwork_asset_id");--> statement-breakpoint
CREATE INDEX "editorial_collections_lifecycle_queue_idx" ON "editorial_collections" USING btree ("lifecycle_status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "creative_process_disclosures_submission_version_unique" ON "creative_process_disclosures" USING btree ("submission_id","version") WHERE "creative_process_disclosures"."submission_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "creative_process_disclosures_release_version_unique" ON "creative_process_disclosures" USING btree ("release_id","version") WHERE "creative_process_disclosures"."release_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "creative_process_disclosures_track_version_unique" ON "creative_process_disclosures" USING btree ("track_id","version") WHERE "creative_process_disclosures"."track_id" is not null;--> statement-breakpoint
CREATE INDEX "creative_process_disclosures_submission_id_idx" ON "creative_process_disclosures" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "creative_process_disclosures_release_id_idx" ON "creative_process_disclosures" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "creative_process_disclosures_track_id_idx" ON "creative_process_disclosures" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "creative_process_disclosures_supersedes_id_idx" ON "creative_process_disclosures" USING btree ("supersedes_id");--> statement-breakpoint
CREATE INDEX "creative_process_disclosures_status_idx" ON "creative_process_disclosures" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_evidence_storage_ref_unique" ON "provenance_evidence" USING btree ("storage_provider","object_key");--> statement-breakpoint
CREATE INDEX "provenance_evidence_provenance_record_id_idx" ON "provenance_evidence" USING btree ("provenance_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_records_submission_version_unique" ON "provenance_records" USING btree ("submission_id","version") WHERE "provenance_records"."submission_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_records_release_version_unique" ON "provenance_records" USING btree ("release_id","version") WHERE "provenance_records"."release_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_records_track_version_unique" ON "provenance_records" USING btree ("track_id","version") WHERE "provenance_records"."track_id" is not null;--> statement-breakpoint
CREATE INDEX "provenance_records_submission_id_idx" ON "provenance_records" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "provenance_records_release_id_idx" ON "provenance_records" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "provenance_records_track_id_idx" ON "provenance_records" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "provenance_records_supersedes_id_idx" ON "provenance_records" USING btree ("supersedes_id");--> statement-breakpoint
CREATE INDEX "provenance_records_status_idx" ON "provenance_records" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_sources_position_unique" ON "provenance_sources" USING btree ("provenance_record_id","position");--> statement-breakpoint
CREATE INDEX "provenance_sources_record_order_idx" ON "provenance_sources" USING btree ("provenance_record_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_steps_position_unique" ON "provenance_steps" USING btree ("provenance_record_id","position");--> statement-breakpoint
CREATE INDEX "provenance_steps_record_order_idx" ON "provenance_steps" USING btree ("provenance_record_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "rights_declarations_submission_version_unique" ON "rights_declarations" USING btree ("submission_id","version") WHERE "rights_declarations"."submission_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rights_declarations_release_version_unique" ON "rights_declarations" USING btree ("release_id","version") WHERE "rights_declarations"."release_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rights_declarations_track_version_unique" ON "rights_declarations" USING btree ("track_id","version") WHERE "rights_declarations"."track_id" is not null;--> statement-breakpoint
CREATE INDEX "rights_declarations_submission_id_idx" ON "rights_declarations" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "rights_declarations_release_id_idx" ON "rights_declarations" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "rights_declarations_track_id_idx" ON "rights_declarations" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "rights_declarations_supersedes_id_idx" ON "rights_declarations" USING btree ("supersedes_id");--> statement-breakpoint
CREATE INDEX "rights_declarations_status_idx" ON "rights_declarations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_invitation_reference_idx" ON "submissions" USING btree ("invitation_reference");--> statement-breakpoint
CREATE INDEX "submissions_status_queue_idx" ON "submissions" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "submissions_review_queue_idx" ON "submissions" USING btree ("status","reviewed_at");--> statement-breakpoint
CREATE INDEX "submissions_resulting_release_id_idx" ON "submissions" USING btree ("resulting_release_id");--> statement-breakpoint
CREATE INDEX "submissions_resulting_track_id_idx" ON "submissions" USING btree ("resulting_track_id");--> statement-breakpoint
CREATE FUNCTION "check_release_has_artist_credit"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	release_to_check uuid;
BEGIN
	IF TG_TABLE_NAME = 'releases' THEN
		release_to_check := NEW.id;
	ELSIF TG_OP = 'DELETE' THEN
		release_to_check := OLD.release_id;
	ELSE
		release_to_check := NEW.release_id;
	END IF;

	PERFORM 1 FROM releases WHERE id = release_to_check FOR UPDATE;
	IF FOUND AND NOT EXISTS (
			SELECT 1 FROM release_artist_credits WHERE release_id = release_to_check
		)
	THEN
		RAISE EXCEPTION 'release % must have at least one artist credit', release_to_check
			USING ERRCODE = '23514';
	END IF;

	IF TG_TABLE_NAME = 'release_artist_credits'
		AND TG_OP = 'UPDATE'
		AND OLD.release_id IS DISTINCT FROM NEW.release_id
	THEN
		PERFORM 1 FROM releases WHERE id = OLD.release_id FOR UPDATE;
	END IF;

	IF TG_TABLE_NAME = 'release_artist_credits'
		AND TG_OP = 'UPDATE'
		AND OLD.release_id IS DISTINCT FROM NEW.release_id
		AND FOUND
		AND NOT EXISTS (
			SELECT 1 FROM release_artist_credits WHERE release_id = OLD.release_id
		)
	THEN
		RAISE EXCEPTION 'release % must have at least one artist credit', OLD.release_id
			USING ERRCODE = '23514';
	END IF;

	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "releases_require_artist_credit"
AFTER INSERT OR UPDATE ON "releases"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_release_has_artist_credit"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "release_artist_credits_preserve_credit"
AFTER INSERT OR UPDATE OR DELETE ON "release_artist_credits"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_release_has_artist_credit"();