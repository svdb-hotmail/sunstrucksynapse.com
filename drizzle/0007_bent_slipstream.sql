CREATE TABLE "playback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"anonymous_session_hash" text NOT NULL,
	"track_id" uuid,
	"collection_id" uuid,
	"progress_seconds" integer,
	"is_bot" integer DEFAULT 0 NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playback_events_name_check" CHECK ("playback_events"."event_name" in ('catalogue_impression', 'collection_view', 'play_requested', 'playback_started', 'listen_30_seconds', 'completion', 'skip', 'replay', 'playback_error', 'share', 'outbound_artist_click')),
	CONSTRAINT "playback_events_session_hash_check" CHECK ("playback_events"."anonymous_session_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "playback_events_progress_check" CHECK ("playback_events"."progress_seconds" is null or "playback_events"."progress_seconds" >= 0),
	CONSTRAINT "playback_events_bot_check" CHECK ("playback_events"."is_bot" in (0, 1))
);
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "genre" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "moods" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "creative_process_tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_collection_id_editorial_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."editorial_collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "playback_events_event_id_unique" ON "playback_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "playback_events_occurred_at_idx" ON "playback_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "playback_events_track_idx" ON "playback_events" USING btree ("track_id","occurred_at");--> statement-breakpoint
CREATE INDEX "playback_events_collection_idx" ON "playback_events" USING btree ("collection_id","occurred_at");