CREATE TABLE "video_assets" (
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
	CONSTRAINT "video_assets_checksum_sha256_check" CHECK ("video_assets"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "video_assets_byte_size_check" CHECK ("video_assets"."byte_size" > 0),
	CONSTRAINT "video_assets_duration_check" CHECK ("video_assets"."duration_ms" > 0),
	CONSTRAINT "video_assets_mime_type_check" CHECK ("video_assets"."mime_type" ~ '^video/')
);
--> statement-breakpoint
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_assets_object_key_unique" ON "video_assets" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "video_assets_track_scope_primary_unique" ON "video_assets" USING btree ("track_id","scope") WHERE "video_assets"."is_primary";--> statement-breakpoint
CREATE INDEX "video_assets_track_id_idx" ON "video_assets" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "video_assets_scope_idx" ON "video_assets" USING btree ("scope");--> statement-breakpoint
INSERT INTO "video_assets" (
	"id",
	"track_id",
	"object_key",
	"scope",
	"mime_type",
	"checksum_sha256",
	"byte_size",
	"duration_ms",
	"codec",
	"is_primary",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"track_id",
	"object_key",
	"scope",
	"mime_type",
	"checksum_sha256",
	"byte_size",
	"duration_ms",
	"codec",
	"is_primary",
	"created_at",
	"updated_at"
FROM "audio_assets"
WHERE "mime_type" LIKE 'video/%'
ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM "audio_assets" WHERE "mime_type" LIKE 'video/%';--> statement-breakpoint
CREATE TRIGGER "video_assets_set_updated_at"
BEFORE UPDATE ON "video_assets"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
ALTER TABLE "audio_assets" ADD CONSTRAINT "audio_assets_mime_type_check" CHECK ("audio_assets"."mime_type" ~ '^audio/');