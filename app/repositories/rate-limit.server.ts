import { lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { requestRateLimits } from "~/db/schema";
import * as schema from "~/db/schema";

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimitRepository {
  consume(
    scope: string,
    keyHash: string,
    limit: number,
    windowSeconds: number,
    now?: Date,
  ): Promise<RateLimitDecision>;
  purgeBefore(cutoff: Date): Promise<number>;
}

export function createMemoryRateLimitRepository(): RateLimitRepository {
  const counts = new Map<string, number>();
  return {
    async consume(scope, keyHash, limit, windowSeconds, now = new Date()) {
      const windowStartedAt = Math.floor(now.valueOf() / (windowSeconds * 1000)) * windowSeconds;
      const key = `${scope}:${keyHash}:${windowStartedAt}`;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return {
        allowed: count <= limit,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((windowStartedAt * 1000 + windowSeconds * 1000 - now.valueOf()) / 1000),
        ),
      };
    },
    async purgeBefore() {
      counts.clear();
      return 0;
    },
  };
}

export function createRateLimitRepository<TQueryResult extends PgQueryResultHKT>(
  db: PgDatabase<TQueryResult, typeof schema>,
): RateLimitRepository {
  return {
    async consume(scope, keyHash, limit, windowSeconds, now = new Date()) {
      const windowStartedAt = new Date(
        Math.floor(now.valueOf() / (windowSeconds * 1000)) * windowSeconds * 1000,
      );
      const rows = await db
        .insert(requestRateLimits)
        .values({ scope, keyHash, windowStartedAt })
        .onConflictDoUpdate({
          target: [
            requestRateLimits.scope,
            requestRateLimits.keyHash,
            requestRateLimits.windowStartedAt,
          ],
          set: { requestCount: sql`${requestRateLimits.requestCount} + 1` },
        })
        .returning({ count: requestRateLimits.requestCount });
      return {
        allowed: (rows[0]?.count ?? limit + 1) <= limit,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((windowStartedAt.valueOf() + windowSeconds * 1000 - now.valueOf()) / 1000),
        ),
      };
    },
    async purgeBefore(cutoff) {
      const rows = await db
        .delete(requestRateLimits)
        .where(lt(requestRateLimits.windowStartedAt, cutoff))
        .returning({ scope: requestRateLimits.scope });
      return rows.length;
    },
  };
}
