CREATE TABLE "curation_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"error_code" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curation_outbox_idempotency_key_check" CHECK (nullif(btrim("curation_outbox"."idempotency_key"), '') is not null and char_length("curation_outbox"."idempotency_key") <= 200),
	CONSTRAINT "curation_outbox_kind_check" CHECK (nullif(btrim("curation_outbox"."kind"), '') is not null and char_length("curation_outbox"."kind") <= 100),
	CONSTRAINT "curation_outbox_payload_check" CHECK (jsonb_typeof("curation_outbox"."payload") = 'object' and octet_length("curation_outbox"."payload"::text) <= 65536),
	CONSTRAINT "curation_outbox_status_check" CHECK ("curation_outbox"."status" in ('pending', 'processing', 'succeeded', 'failed')),
	CONSTRAINT "curation_outbox_attempts_check" CHECK ("curation_outbox"."attempts" between 0 and 10),
	CONSTRAINT "curation_outbox_lease_check" CHECK ((
        ("curation_outbox"."status" = 'processing' and "curation_outbox"."lease_token" is not null and "curation_outbox"."lease_expires_at" is not null)
        or ("curation_outbox"."status" <> 'processing' and "curation_outbox"."lease_token" is null and "curation_outbox"."lease_expires_at" is null)
      )),
	CONSTRAINT "curation_outbox_completion_check" CHECK ((
        ("curation_outbox"."status" in ('pending', 'processing') and "curation_outbox"."completed_at" is null)
        or ("curation_outbox"."status" in ('succeeded', 'failed') and "curation_outbox"."completed_at" is not null)
      )),
	CONSTRAINT "curation_outbox_error_code_check" CHECK ("curation_outbox"."error_code" is null or "curation_outbox"."error_code" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
	CONSTRAINT "curation_outbox_succeeded_error_check" CHECK ("curation_outbox"."status" <> 'succeeded' or "curation_outbox"."error_code" is null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "curation_outbox_idempotency_key_unique" ON "curation_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "curation_outbox_claim_idx" ON "curation_outbox" USING btree ("status","available_at","lease_expires_at");