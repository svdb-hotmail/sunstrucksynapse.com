CREATE TABLE "track_artwork_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"artwork_asset_id" uuid NOT NULL,
	"role" "artwork_role" DEFAULT 'gallery' NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_artwork_assets_position_unique" UNIQUE("track_id","role","position"),
	CONSTRAINT "track_artwork_assets_asset_unique" UNIQUE("track_id","artwork_asset_id","role"),
	CONSTRAINT "track_artwork_assets_position_check" CHECK ("track_artwork_assets"."position" > 0)
);
--> statement-breakpoint
ALTER TABLE "track_artwork_assets" ADD CONSTRAINT "track_artwork_assets_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artwork_assets" ADD CONSTRAINT "track_artwork_assets_artwork_asset_id_artwork_assets_id_fk" FOREIGN KEY ("artwork_asset_id") REFERENCES "public"."artwork_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_artwork_assets_track_id_idx" ON "track_artwork_assets" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_artwork_assets_artwork_asset_id_idx" ON "track_artwork_assets" USING btree ("artwork_asset_id");