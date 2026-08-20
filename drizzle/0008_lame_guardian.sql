CREATE TABLE "request_rate_limits" (
	"scope" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "request_rate_limits_scope_key_hash_window_started_at_pk" PRIMARY KEY("scope","key_hash","window_started_at"),
	CONSTRAINT "request_rate_limits_scope_check" CHECK (length("request_rate_limits"."scope") between 1 and 64),
	CONSTRAINT "request_rate_limits_key_hash_check" CHECK ("request_rate_limits"."key_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "request_rate_limits_count_check" CHECK ("request_rate_limits"."request_count" > 0)
);
--> statement-breakpoint
CREATE INDEX "request_rate_limits_cleanup_idx" ON "request_rate_limits" USING btree ("window_started_at");