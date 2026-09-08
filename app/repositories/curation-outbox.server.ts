import { sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { curationOutbox } from "~/db/schema";
import * as schema from "~/db/schema";

export const CURATION_OUTBOX_MAX_IDEMPOTENCY_KEY_LENGTH = 200;
export const CURATION_OUTBOX_MAX_KIND_LENGTH = 100;
export const CURATION_OUTBOX_MAX_PAYLOAD_BYTES = 65_536;
export const CURATION_OUTBOX_MAX_ATTEMPTS = 10;
export const CURATION_OUTBOX_DEFAULT_CLAIM_LIMIT = 10;
export const CURATION_OUTBOX_DEFAULT_LEASE_SECONDS = 60;
export const CURATION_OUTBOX_DEFAULT_RETRY_DELAY_SECONDS = 60;

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CurationOutboxEnqueueInput {
  idempotencyKey: string;
  kind: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
}

export interface CurationOutboxClaimedRow {
  id: string;
  idempotencyKey: string;
  kind: string;
  payload: Record<string, unknown>;
  status: "processing";
  attempts: number;
  availableAt: Date;
  leaseToken: string;
  leaseExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

type IdRow = { id: string };

type RawClaimedRow = {
  id: string;
  idempotencyKey: string;
  kind: string;
  payload: Record<string, unknown> | string;
  status: "processing";
  attempts: number | string;
  availableAt: Date | string;
  leaseToken: string;
  leaseExpiresAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function assertJsonValue(value: unknown, seen: Set<object>): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError("Curation outbox payload must contain only JSON values.");
  }
  if (typeof value !== "object") {
    throw new TypeError("Curation outbox payload must contain only JSON values.");
  }
  if (seen.has(value)) {
    throw new TypeError("Curation outbox payload must contain only JSON values.");
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (const item of value) assertJsonValue(item, seen);
      return;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Curation outbox payload must contain only JSON values.");
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError("Curation outbox payload must contain only JSON values.");
    }
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if (!("value" in descriptor)) {
        throw new TypeError("Curation outbox payload must contain only JSON values.");
      }
      assertJsonValue(descriptor.value, seen);
    }
  } finally {
    seen.delete(value);
  }
}

function validateEnqueueInput(input: CurationOutboxEnqueueInput) {
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length === 0) {
    throw new TypeError("Curation outbox idempotency key must be non-empty.");
  }
  if (input.idempotencyKey.length > CURATION_OUTBOX_MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new TypeError("Curation outbox idempotency key is too long.");
  }
  if (typeof input.kind !== "string" || input.kind.trim().length === 0) {
    throw new TypeError("Curation outbox kind must be non-empty.");
  }
  if (input.kind.length > CURATION_OUTBOX_MAX_KIND_LENGTH) {
    throw new TypeError("Curation outbox kind is too long.");
  }
  if (
    typeof input.payload !== "object" ||
    input.payload === null ||
    Array.isArray(input.payload) ||
    (Object.getPrototypeOf(input.payload) !== Object.prototype &&
      Object.getPrototypeOf(input.payload) !== null)
  ) {
    throw new TypeError("Curation outbox payload must be a plain JSON object.");
  }
  assertJsonValue(input.payload, new Set());
  let serialized: string;
  try {
    serialized = JSON.stringify(input.payload);
  } catch {
    throw new TypeError("Curation outbox payload must be JSON-serializable.");
  }
  // This compact representation rejects oversized input early. PostgreSQL's
  // jsonb::text CHECK remains authoritative because its canonical form can differ.
  if (new TextEncoder().encode(serialized).byteLength > CURATION_OUTBOX_MAX_PAYLOAD_BYTES) {
    throw new TypeError("Curation outbox payload is too large.");
  }
  if (
    input.availableAt !== undefined &&
    (!(input.availableAt instanceof Date) || Number.isNaN(input.availableAt.getTime()))
  ) {
    throw new TypeError("Curation outbox availability time is invalid.");
  }
  return { serialized, availableAt: input.availableAt?.toISOString() ?? null };
}

function boundedInteger(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`Curation outbox ${label} is invalid.`);
  }
  return value;
}

function validateUuid(value: string, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new TypeError(`Curation outbox ${label} is invalid.`);
  }
  return value;
}

function validateErrorCode(value: string): string {
  if (typeof value !== "string" || !ERROR_CODE_PATTERN.test(value)) {
    throw new TypeError("Curation outbox error code is invalid.");
  }
  return value;
}

function parsedDate(value: Date | string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError("Curation outbox returned an invalid timestamp.");
  }
  return parsed;
}

function isPayloadRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsedPayload(value: Record<string, unknown> | string): Record<string, unknown> {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new TypeError("Curation outbox returned an invalid payload.");
    }
  }
  if (!isPayloadRecord(parsed)) {
    throw new TypeError("Curation outbox returned an invalid payload.");
  }
  return parsed;
}

export function buildCurationOutboxInsert(input: CurationOutboxEnqueueInput): SQL {
  const { serialized, availableAt } = validateEnqueueInput(input);
  return sql`
    insert into ${curationOutbox} (idempotency_key, kind, payload, available_at)
    values (${input.idempotencyKey}, ${input.kind}, ${serialized}::jsonb, coalesce(${availableAt}::timestamptz, now()))
    on conflict (idempotency_key) do nothing
    returning id
  `;
}

export function createCurationOutboxRepository<TQueryResult extends PgQueryResultHKT>(
  db: PgDatabase<TQueryResult, typeof schema>,
) {
  async function executeRows<T extends Record<string, unknown>>(query: SQL): Promise<T[]> {
    const result: unknown = await db.execute<T>(query);
    if (Array.isArray(result)) return result as T[];
    if (typeof result === "object" && result !== null) {
      const rows = Reflect.get(result, "rows");
      if (Array.isArray(rows)) return rows as T[];
    }
    throw new Error("Unsupported database query result.");
  }

  return {
    async statusCounts(): Promise<
      Record<"pending" | "processing" | "succeeded" | "failed", number>
    > {
      const rows = await executeRows<{ status: string; count: number | string }>(sql`
        select status, count(*)::integer as count
        from ${curationOutbox}
        group by status
      `);
      const counts = { pending: 0, processing: 0, succeeded: 0, failed: 0 };
      for (const row of rows) {
        if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.count);
      }
      return counts;
    },

    async enqueue(input: CurationOutboxEnqueueInput): Promise<string | null> {
      const rows = await executeRows<IdRow>(buildCurationOutboxInsert(input));
      return rows[0]?.id ?? null;
    },

    async claim(
      options: { limit?: number; leaseSeconds?: number } = {},
    ): Promise<CurationOutboxClaimedRow[]> {
      const limit = boundedInteger(
        options.limit ?? CURATION_OUTBOX_DEFAULT_CLAIM_LIMIT,
        1,
        100,
        "claim limit",
      );
      const leaseSeconds = boundedInteger(
        options.leaseSeconds ?? CURATION_OUTBOX_DEFAULT_LEASE_SECONDS,
        1,
        900,
        "lease duration",
      );
      const rows = await executeRows<RawClaimedRow>(sql`
        with expired_exhausted as (
          select id
          from ${curationOutbox}
          where status = 'processing'
            and lease_expires_at <= now()
            and attempts >= ${CURATION_OUTBOX_MAX_ATTEMPTS}
          order by lease_expires_at, id
          limit ${limit}
          for update skip locked
        ), exhausted as (
          update ${curationOutbox} as outbox
          set
            status = 'failed',
            completed_at = now(),
            error_code = 'RETRY_EXHAUSTED',
            lease_token = null,
            lease_expires_at = null,
            updated_at = now()
          from expired_exhausted
          where outbox.id = expired_exhausted.id
          returning outbox.id
        ), candidates as (
          select id
          from ${curationOutbox}
          where attempts < ${CURATION_OUTBOX_MAX_ATTEMPTS}
            and (
              (status = 'pending' and available_at <= now())
              or (status = 'processing' and lease_expires_at <= now())
            )
          order by available_at, created_at, id
          limit ${limit}
          for update skip locked
        ), claimed as (
          update ${curationOutbox} as outbox
          set
            status = 'processing',
            attempts = outbox.attempts + 1,
            lease_token = gen_random_uuid(),
            lease_expires_at = now() + (${leaseSeconds} * interval '1 second'),
            error_code = null,
            completed_at = null,
            updated_at = now()
          from candidates
          where outbox.id = candidates.id
          returning
            outbox.id as "id",
            outbox.idempotency_key as "idempotencyKey",
            outbox.kind as "kind",
            outbox.payload as "payload",
            outbox.status as "status",
            outbox.attempts as "attempts",
            outbox.available_at as "availableAt",
            outbox.lease_token as "leaseToken",
            outbox.lease_expires_at as "leaseExpiresAt",
            outbox.created_at as "createdAt",
            outbox.updated_at as "updatedAt"
        )
        select * from claimed order by "availableAt", "createdAt", "id"
      `);
      return rows.map((row) => ({
        ...row,
        payload: parsedPayload(row.payload),
        status: "processing",
        attempts: Number(row.attempts),
        availableAt: parsedDate(row.availableAt),
        leaseExpiresAt: parsedDate(row.leaseExpiresAt),
        createdAt: parsedDate(row.createdAt),
        updatedAt: parsedDate(row.updatedAt),
      }));
    },

    /**
     * Returns true only for the guarded processing-to-succeeded transition.
     * Repeating an acknowledged lease returns false without changing terminal state;
     * the completed row intentionally no longer retains its lease token.
     */
    async acknowledge(id: string, leaseToken: string): Promise<boolean> {
      validateUuid(id, "id");
      validateUuid(leaseToken, "lease token");
      const rows = await executeRows<IdRow>(sql`
        update ${curationOutbox}
        set
          status = 'succeeded',
          completed_at = now(),
          lease_token = null,
          lease_expires_at = null,
          error_code = null,
          updated_at = now()
        where id = ${id}::uuid
          and status = 'processing'
          and lease_token = ${leaseToken}::uuid
          and lease_expires_at > now()
        returning id
      `);
      return rows.length > 0;
    },

    async retry(
      id: string,
      leaseToken: string,
      errorCode: string,
      delaySeconds = CURATION_OUTBOX_DEFAULT_RETRY_DELAY_SECONDS,
    ): Promise<boolean> {
      validateUuid(id, "id");
      validateUuid(leaseToken, "lease token");
      const safeErrorCode = validateErrorCode(errorCode);
      const delay = boundedInteger(delaySeconds, 0, 86_400, "retry delay");
      const rows = await executeRows<IdRow>(sql`
        update ${curationOutbox}
        set
          status = case when attempts < ${CURATION_OUTBOX_MAX_ATTEMPTS} then 'pending' else 'failed' end,
          available_at = case
            when attempts < ${CURATION_OUTBOX_MAX_ATTEMPTS}
              then now() + (${delay} * interval '1 second')
            else available_at
          end,
          completed_at = case
            when attempts < ${CURATION_OUTBOX_MAX_ATTEMPTS} then null
            else now()
          end,
          lease_token = null,
          lease_expires_at = null,
          error_code = ${safeErrorCode},
          updated_at = now()
        where id = ${id}::uuid
          and status = 'processing'
          and lease_token = ${leaseToken}::uuid
          and lease_expires_at > now()
        returning id
      `);
      return rows.length > 0;
    },
  };
}
