CREATE TYPE "public"."managed_asset_status" AS ENUM('ready', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('static', 'r2');--> statement-breakpoint
CREATE TYPE "public"."upload_asset_kind" AS ENUM('artwork', 'audio');--> statement-breakpoint
CREATE TYPE "public"."upload_session_status" AS ENUM('pending', 'completed', 'abandoned', 'failed');--> statement-breakpoint
CREATE TABLE "publication_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_lifecycle" "catalogue_lifecycle" NOT NULL,
	"to_lifecycle" "catalogue_lifecycle" NOT NULL,
	"actor_email" text NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_audit_entity_type_check" CHECK ("publication_audit"."entity_type" in ('artist', 'release', 'track', 'collection')),
	CONSTRAINT "publication_audit_reason_check" CHECK ("publication_audit"."to_lifecycle" not in ('published', 'archived') or nullif(btrim("publication_audit"."reason"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_kind" "upload_asset_kind" NOT NULL,
	"target_entity_id" uuid,
	"object_key" text NOT NULL,
	"scope" "asset_scope" NOT NULL,
	"status" "upload_session_status" DEFAULT 'pending' NOT NULL,
	"mime_type" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"codec" text,
	"actor_email" text NOT NULL,
	"actor_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_sessions_checksum_check" CHECK ("upload_sessions"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "upload_sessions_byte_size_check" CHECK ("upload_sessions"."byte_size" > 0),
	CONSTRAINT "upload_sessions_metadata_check" CHECK ((
        ("upload_sessions"."asset_kind" = 'artwork' and "upload_sessions"."width" > 0 and "upload_sessions"."height" > 0 and "upload_sessions"."duration_ms" is null and "upload_sessions"."codec" is null and "upload_sessions"."mime_type" ~ '^image/')
        or
        ("upload_sessions"."asset_kind" = 'audio' and "upload_sessions"."width" is null and "upload_sessions"."height" is null and "upload_sessions"."duration_ms" > 0 and nullif(btrim("upload_sessions"."codec"), '') is not null and "upload_sessions"."mime_type" ~ '^audio/')
      )),
	CONSTRAINT "upload_sessions_state_check" CHECK ((
        ("upload_sessions"."status" = 'pending' and "upload_sessions"."completed_at" is null and "upload_sessions"."failure_reason" is null)
        or ("upload_sessions"."status" = 'completed' and "upload_sessions"."completed_at" is not null and "upload_sessions"."failure_reason" is null)
        or ("upload_sessions"."status" in ('abandoned', 'failed') and "upload_sessions"."completed_at" is null)
      ))
);
--> statement-breakpoint
ALTER TABLE "artwork_assets" ADD COLUMN "storage_provider" "storage_provider" DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "artwork_assets" ADD COLUMN "status" "managed_asset_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "audio_assets" ADD COLUMN "storage_provider" "storage_provider" DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "audio_assets" ADD COLUMN "status" "managed_asset_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_assets" ADD COLUMN "storage_provider" "storage_provider" DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_assets" ADD COLUMN "status" "managed_asset_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "editorial_collections" ADD COLUMN "show_on_homepage" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "editorial_collections" ADD COLUMN "homepage_position" integer;--> statement-breakpoint
CREATE INDEX "publication_audit_entity_history_idx" ON "publication_audit" USING btree ("entity_type","entity_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "publication_audit_actor_idx" ON "publication_audit" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_sessions_object_key_unique" ON "upload_sessions" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "upload_sessions_cleanup_idx" ON "upload_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "upload_sessions_actor_idx" ON "upload_sessions" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "artwork_assets_delivery_idx" ON "artwork_assets" USING btree ("storage_provider","status","scope");--> statement-breakpoint
CREATE INDEX "audio_assets_delivery_idx" ON "audio_assets" USING btree ("storage_provider","status","scope");--> statement-breakpoint
CREATE INDEX "video_assets_delivery_idx" ON "video_assets" USING btree ("storage_provider","status","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_collections_homepage_position_unique" ON "editorial_collections" USING btree ("homepage_position") WHERE "editorial_collections"."show_on_homepage";--> statement-breakpoint
ALTER TABLE "editorial_collections" ADD CONSTRAINT "editorial_collections_homepage_config_check" CHECK (("editorial_collections"."show_on_homepage" and "editorial_collections"."homepage_position" > 0) or (not "editorial_collections"."show_on_homepage" and "editorial_collections"."homepage_position" is null));