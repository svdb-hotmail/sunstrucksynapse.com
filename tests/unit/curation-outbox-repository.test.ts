import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "../../app/db/schema";
import {
  buildCurationOutboxInsert,
  createCurationOutboxRepository,
} from "../../app/repositories/curation-outbox.server";

type StoredOutboxRow = {
  id: string;
  idempotency_key: string;
  kind: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "succeeded" | "failed";
  attempts: number;
  available_at: Date | string;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  error_code: string | null;
  completed_at: Date | string | null;
  updated_at: Date | string;
};

describe("curation outbox repository", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: ReturnType<typeof createCurationOutboxRepository>;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    repository = createCurationOutboxRepository(db);
  }, 30_000);

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await client.exec("truncate table curation_outbox");
  });

  async function stored(idempotencyKey: string) {
    const result = await client.query<StoredOutboxRow>(
      "select * from curation_outbox where idempotency_key = $1",
      [idempotencyKey],
    );
    return result.rows[0] ?? null;
  }

  it("inserts an idempotency key once without overwriting its original payload", async () => {
    const input = {
      idempotencyKey: "submission:accepted:one",
      kind: "submission.accepted",
      payload: { submissionId: "one", source: "original" },
    };

    // PGlite serializes calls on this connection. This exercises conflict behavior,
    // not true multi-connection lock scheduling.
    const ids = await Promise.all([repository.enqueue(input), repository.enqueue(input)]);
    expect(ids.filter((id) => id !== null)).toHaveLength(1);

    await expect(
      repository.enqueue({ ...input, payload: { submissionId: "one", source: "changed" } }),
    ).resolves.toBeNull();
    expect((await stored(input.idempotencyKey))?.payload).toEqual(input.payload);
  });

  it("claims only due work and gives competing claims distinct leases", async () => {
    await repository.enqueue({
      idempotencyKey: "future",
      kind: "email.send",
      payload: {},
      availableAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await Promise.all(
      ["one", "two", "three", "four"].map((key) =>
        repository.enqueue({ idempotencyKey: key, kind: "email.send", payload: { key } }),
      ),
    );

    // These calls are serialized by one PGlite connection; distinct results are
    // evidence for guarded claims, not proof of multi-connection SKIP LOCKED behavior.
    const batches = await Promise.all([
      repository.claim({ limit: 2 }),
      repository.claim({ limit: 2 }),
    ]);
    const claimed = batches.flat();

    expect(claimed).toHaveLength(4);
    expect(new Set(claimed.map(({ id }) => id)).size).toBe(4);
    expect(new Set(claimed.map(({ leaseToken }) => leaseToken)).size).toBe(4);
    expect(claimed.every(({ attempts, status }) => attempts === 1 && status === "processing")).toBe(
      true,
    );
    expect((await stored("future"))?.status).toBe("pending");
  });

  it("rejects wrong or stale lease tokens and reclaims an expired lease", async () => {
    await repository.enqueue({ idempotencyKey: "lease", kind: "email.send", payload: {} });
    const first = (await repository.claim())[0]!;
    const wrongToken = crypto.randomUUID();

    await expect(repository.acknowledge(first.id, wrongToken)).resolves.toBe(false);
    await expect(repository.retry(first.id, wrongToken, "DELIVERY_FAILED")).resolves.toBe(false);

    await client.query(
      "update curation_outbox set lease_expires_at = now() - interval '1 second' where id = $1",
      [first.id],
    );
    await expect(repository.acknowledge(first.id, first.leaseToken)).resolves.toBe(false);
    await expect(repository.retry(first.id, first.leaseToken, "DELIVERY_FAILED")).resolves.toBe(
      false,
    );

    const reclaimed = (await repository.claim())[0]!;
    expect(reclaimed.id).toBe(first.id);
    expect(reclaimed.leaseToken).not.toBe(first.leaseToken);
    expect(reclaimed.attempts).toBe(2);
  });

  it("acknowledges once and protects terminal success from every later mutation", async () => {
    await repository.enqueue({ idempotencyKey: "success", kind: "email.send", payload: {} });
    const claimed = (await repository.claim())[0]!;

    await expect(repository.acknowledge(claimed.id, claimed.leaseToken)).resolves.toBe(true);
    await expect(repository.acknowledge(claimed.id, claimed.leaseToken)).resolves.toBe(false);
    await expect(repository.retry(claimed.id, claimed.leaseToken, "DELIVERY_FAILED")).resolves.toBe(
      false,
    );
    await expect(
      client.query("update curation_outbox set kind = 'tampered' where id = $1", [claimed.id]),
    ).rejects.toThrow("Curation outbox succeeded rows are immutable.");
    await expect(
      client.query("delete from curation_outbox where id = $1", [claimed.id]),
    ).rejects.toThrow("Curation outbox succeeded rows are immutable.");

    expect(await stored("success")).toMatchObject({
      kind: "email.send",
      status: "succeeded",
      lease_token: null,
      lease_expires_at: null,
      error_code: null,
    });
  });

  it("defers retries and terminally fails both explicit and abandoned tenth attempts", async () => {
    await repository.enqueue({ idempotencyKey: "retry", kind: "email.send", payload: {} });
    const first = (await repository.claim())[0]!;
    await expect(
      repository.retry(first.id, first.leaseToken, "DELIVERY_FAILED", 3600),
    ).resolves.toBe(true);
    await expect(repository.claim()).resolves.toEqual([]);

    await client.query(
      "update curation_outbox set available_at = now() - interval '1 second' where id = $1",
      [first.id],
    );
    const dueRetry = (await repository.claim())[0]!;
    expect(dueRetry.leaseToken).not.toBe(first.leaseToken);
    expect(dueRetry.attempts).toBe(2);

    await client.query(
      "update curation_outbox set status = 'pending', attempts = 9, lease_token = null, lease_expires_at = null where id = $1",
      [dueRetry.id],
    );
    const tenth = (await repository.claim())[0]!;
    expect(tenth.attempts).toBe(10);
    await expect(repository.retry(tenth.id, tenth.leaseToken, "DELIVERY_FAILED", 0)).resolves.toBe(
      true,
    );
    expect(await stored("retry")).toMatchObject({
      status: "failed",
      attempts: 10,
      error_code: "DELIVERY_FAILED",
    });

    await repository.enqueue({ idempotencyKey: "abandoned", kind: "email.send", payload: {} });
    const abandonedToken = crypto.randomUUID();
    await client.query(
      `update curation_outbox
       set status = 'processing', attempts = 10, lease_token = $2,
           lease_expires_at = now() - interval '1 second'
       where idempotency_key = $1`,
      ["abandoned", abandonedToken],
    );
    await expect(repository.claim()).resolves.toEqual([]);
    expect(await stored("abandoned")).toMatchObject({
      status: "failed",
      attempts: 10,
      error_code: "RETRY_EXHAUSTED",
      lease_token: null,
      lease_expires_at: null,
    });
  });

  it("validates API inputs and database state invariants", async () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const untypedEnqueue = (input: unknown) =>
      Reflect.apply(repository.enqueue, repository, [input]);

    await expect(
      untypedEnqueue({ idempotencyKey: "array", kind: "event", payload: [] }),
    ).rejects.toThrow(TypeError);
    await expect(
      repository.enqueue({ idempotencyKey: "cycle", kind: "event", payload: cycle }),
    ).rejects.toThrow(TypeError);
    await expect(
      repository.enqueue({ idempotencyKey: "infinite", kind: "event", payload: { n: Infinity } }),
    ).rejects.toThrow(TypeError);
    await expect(
      repository.enqueue({
        idempotencyKey: "oversize",
        kind: "event",
        payload: { value: "x".repeat(65_536) },
      }),
    ).rejects.toThrow(TypeError);
    await expect(
      repository.enqueue({ idempotencyKey: " ", kind: "event", payload: {} }),
    ).rejects.toThrow(TypeError);
    await expect(repository.claim({ limit: 0 })).rejects.toThrow(TypeError);
    await expect(repository.claim({ leaseSeconds: 901 })).rejects.toThrow(TypeError);
    await expect(
      repository.retry(crypto.randomUUID(), crypto.randomUUID(), "private-error"),
    ).rejects.toThrow(TypeError);
    await expect(
      repository.retry(crypto.randomUUID(), crypto.randomUUID(), "SAFE_CODE", 86_401),
    ).rejects.toThrow(TypeError);

    const canonicalBoundary = {
      idempotencyKey: "canonical-boundary",
      kind: "event",
      payload: { value: "x".repeat(65_524) },
    };
    expect(new TextEncoder().encode(JSON.stringify(canonicalBoundary.payload)).byteLength).toBe(
      65_536,
    );
    expect(() => buildCurationOutboxInsert(canonicalBoundary)).not.toThrow();
    await expect(repository.enqueue(canonicalBoundary)).rejects.toThrow();
    await expect(stored(canonicalBoundary.idempotencyKey)).resolves.toBeNull();

    const invalidStatements = [
      `insert into curation_outbox (idempotency_key, kind, payload)
       values ('db-array', 'event', '[]'::jsonb)`,
      `insert into curation_outbox (idempotency_key, kind, payload)
       values ('db-oversize', 'event', jsonb_build_object('value', repeat('x', 65536)))`,
      `insert into curation_outbox (idempotency_key, kind, payload, attempts)
       values ('db-attempts', 'event', '{}'::jsonb, 11)`,
      `insert into curation_outbox (idempotency_key, kind, payload, status)
       values ('db-lease', 'event', '{}'::jsonb, 'processing')`,
      `insert into curation_outbox (idempotency_key, kind, payload, error_code)
       values ('db-error', 'event', '{}'::jsonb, 'private-error')`,
      `insert into curation_outbox (idempotency_key, kind, payload, status)
       values ('db-terminal', 'event', '{}'::jsonb, 'succeeded')`,
    ];
    for (const statement of invalidStatements) {
      await expect(client.exec(statement)).rejects.toThrow();
    }

    await client.exec(`
      insert into curation_outbox (
        idempotency_key, kind, payload, created_at, updated_at
      ) values (
        'timestamp', 'event', '{}'::jsonb, '2000-01-01T00:00:00Z', '2000-01-01T00:00:00Z'
      )
    `);
    await client.exec(
      "update curation_outbox set kind = 'updated' where idempotency_key = 'timestamp'",
    );
    expect(new Date((await stored("timestamp"))!.updated_at).getTime()).toBeGreaterThan(
      Date.parse("2000-01-01T00:00:00Z"),
    );
  });

  it("embeds the insert builder and rolls it back with a failing surrounding statement", async () => {
    const embedded = buildCurationOutboxInsert({
      idempotencyKey: "embedded",
      kind: "event",
      payload: { source: "cte" },
    });
    await db.execute(sql`with queued as (${embedded}) select id from queued`);
    expect(await stored("embedded")).toMatchObject({ payload: { source: "cte" } });

    const rolledBack = buildCurationOutboxInsert({
      idempotencyKey: "rolled-back",
      kind: "event",
      payload: {},
    });
    await expect(
      db.execute(sql`with queued as (${rolledBack}) select 1 / 0 from queued`),
    ).rejects.toThrow();
    await expect(stored("rolled-back")).resolves.toBeNull();
  });
});
