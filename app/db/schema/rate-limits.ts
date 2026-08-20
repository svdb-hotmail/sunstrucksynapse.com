import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const requestRateLimits = pgTable(
  "request_rate_limits",
  {
    scope: text("scope").notNull(),
    keyHash: text("key_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").default(1).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.keyHash, table.windowStartedAt] }),
    index("request_rate_limits_cleanup_idx").on(table.windowStartedAt),
    check("request_rate_limits_scope_check", sql`length(${table.scope}) between 1 and 64`),
    check("request_rate_limits_key_hash_check", sql`${table.keyHash} ~ '^[0-9a-f]{64}$'`),
    check("request_rate_limits_count_check", sql`${table.requestCount} > 0`),
  ],
);
