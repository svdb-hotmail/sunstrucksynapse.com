import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "./helpers";

export const curationOutbox = pgTable(
  "curation_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status")
      .$type<"pending" | "processing" | "succeeded" | "failed">()
      .default("pending")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    errorCode: text("error_code"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("curation_outbox_idempotency_key_unique").on(table.idempotencyKey),
    index("curation_outbox_claim_idx").on(table.status, table.availableAt, table.leaseExpiresAt),
    check(
      "curation_outbox_idempotency_key_check",
      sql`nullif(btrim(${table.idempotencyKey}), '') is not null and char_length(${table.idempotencyKey}) <= 200`,
    ),
    check(
      "curation_outbox_kind_check",
      sql`nullif(btrim(${table.kind}), '') is not null and char_length(${table.kind}) <= 100`,
    ),
    check(
      "curation_outbox_payload_check",
      sql`jsonb_typeof(${table.payload}) = 'object' and octet_length(${table.payload}::text) <= 65536`,
    ),
    check(
      "curation_outbox_status_check",
      sql`${table.status} in ('pending', 'processing', 'succeeded', 'failed')`,
    ),
    check("curation_outbox_attempts_check", sql`${table.attempts} between 0 and 10`),
    check(
      "curation_outbox_lease_check",
      sql`(
        (${table.status} = 'processing' and ${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null)
        or (${table.status} <> 'processing' and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null)
      )`,
    ),
    check(
      "curation_outbox_completion_check",
      sql`(
        (${table.status} in ('pending', 'processing') and ${table.completedAt} is null)
        or (${table.status} in ('succeeded', 'failed') and ${table.completedAt} is not null)
      )`,
    ),
    check(
      "curation_outbox_error_code_check",
      sql`${table.errorCode} is null or ${table.errorCode} ~ '^[A-Z][A-Z0-9_]{0,63}$'`,
    ),
    check(
      "curation_outbox_succeeded_error_check",
      sql`${table.status} <> 'succeeded' or ${table.errorCode} is null`,
    ),
  ],
);
