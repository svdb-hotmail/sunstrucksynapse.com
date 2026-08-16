import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";

import * as schema from "../../app/db/schema";
import type { Database } from "../../app/db/client.server";
import { createCuratorRepository } from "../../app/repositories/curator.server";
import { seedDatabase } from "../../scripts/seed-data";

describe("curator repository atomic transactions", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: ReturnType<typeof createCuratorRepository>;

  const actor = { id: "test-actor-1", email: "curator@example.test" };

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedDatabase(db);
    repository = createCuratorRepository(db as unknown as Database);
  }, 30_000);

  afterAll(async () => {
    await client.close();
  });

  it("atomically transitions lifecycle status and inserts publication_audit", async () => {
    const artist = await repository.create("artist", {
      slug: "atomic-test-artist",
      title: "Atomic Test Artist",
    });

    const now = new Date("2026-08-16T12:00:00Z");
    const transitioned = await repository.setLifecycle(
      "artist",
      artist.id,
      "draft",
      "in_review",
      now,
      null,
      actor,
      "Ready for review",
    );

    expect(transitioned).toBe(true);

    const updated = await repository.find("artist", artist.id);
    expect(updated?.lifecycleStatus).toBe("in_review");

    const audit = await repository.listAudit();
    const entry = audit.find(
      (row) => row.entityId === artist.id && row.toLifecycle === "in_review",
    );
    expect(entry).toMatchObject({
      entityType: "artist",
      entityId: artist.id,
      fromLifecycle: "draft",
      toLifecycle: "in_review",
      actorEmail: "curator@example.test",
      reason: "Ready for review",
      occurredAt: now,
    });
  });

  it("preserves optimistic conflict handling and avoids audit insertion on conflict", async () => {
    const artist = await repository.create("artist", {
      slug: "conflict-test-artist",
      title: "Conflict Test Artist",
    });

    const now = new Date("2026-08-16T12:00:00Z");
    // Artist is in 'draft', but we attempt to transition from 'in_review'
    const transitioned = await repository.setLifecycle(
      "artist",
      artist.id,
      "in_review",
      "scheduled",
      now,
      new Date("2026-08-17T00:00:00Z"),
      actor,
      null,
    );

    expect(transitioned).toBe(false);

    const current = await repository.find("artist", artist.id);
    expect(current?.lifecycleStatus).toBe("draft");

    const audit = await repository.listAudit();
    const entry = audit.find((row) => row.entityId === artist.id);
    expect(entry).toBeUndefined();
  });

  it("rolls back entity lifecycle change when publication_audit insertion fails constraint check", async () => {
    const collection = await repository.create("collection", {
      slug: "rollback-collection",
      title: "Rollback Collection",
    });

    const now = new Date("2026-08-16T12:00:00Z");
    await repository.setLifecycle(
      "collection",
      collection.id,
      "draft",
      "in_review",
      now,
      null,
      actor,
      null,
    );

    // Transition to 'published' requires a non-empty reason per publication_audit_reason_check constraint.
    // Passing reason: "" violates the database check constraint on publication_audit.
    await expect(
      repository.setLifecycle(
        "collection",
        collection.id,
        "in_review",
        "published",
        now,
        null,
        actor,
        "", // Violates check constraint: nullif(btrim(reason), '') is not null
      ),
    ).rejects.toThrow();

    // Confirm that because of the single DB transaction, the entity status was rolled back and is STILL in_review
    const current = await repository.find("collection", collection.id);
    expect(current?.lifecycleStatus).toBe("in_review");

    const [rawCollection] = await db
      .select({ lifecycleStatus: schema.editorialCollections.lifecycleStatus })
      .from(schema.editorialCollections)
      .where(eq(schema.editorialCollections.id, collection.id));
    expect(rawCollection?.lifecycleStatus).toBe("in_review");
  });

  it("automatically publishes due records in one transaction per entity and leaves future records scheduled", async () => {
    const dueArtist = await repository.create("artist", {
      slug: "due-pg-artist",
      title: "Due PG Artist",
    });
    const futureArtist = await repository.create("artist", {
      slug: "future-pg-artist",
      title: "Future PG Artist",
    });

    const t0 = new Date("2026-08-16T10:00:00Z");
    await repository.setLifecycle(
      "artist",
      dueArtist.id,
      "draft",
      "in_review",
      t0,
      null,
      actor,
      null,
    );
    await repository.setLifecycle(
      "artist",
      dueArtist.id,
      "in_review",
      "scheduled",
      t0,
      new Date("2026-08-16T11:00:00Z"),
      actor,
      null,
    );

    await repository.setLifecycle(
      "artist",
      futureArtist.id,
      "draft",
      "in_review",
      t0,
      null,
      actor,
      null,
    );
    await repository.setLifecycle(
      "artist",
      futureArtist.id,
      "in_review",
      "scheduled",
      t0,
      new Date("2026-08-16T15:00:00Z"),
      actor,
      null,
    );

    // Run publishScheduled at 2026-08-16T12:00:00Z (after dueArtist, before futureArtist)
    const runTime = new Date("2026-08-16T12:00:00Z");
    const count = await repository.publishScheduled(runTime);
    expect(count).toBe(1);

    const publishedDue = await repository.find("artist", dueArtist.id);
    expect(publishedDue?.lifecycleStatus).toBe("published");
    expect(publishedDue?.scheduledFor).toBeNull();

    const stillScheduledFuture = await repository.find("artist", futureArtist.id);
    expect(stillScheduledFuture?.lifecycleStatus).toBe("scheduled");
    expect(stillScheduledFuture?.scheduledFor).toEqual(new Date("2026-08-16T15:00:00Z"));

    // Repeat at same timestamp -> 0 published (no duplicate)
    const repeatCount = await repository.publishScheduled(runTime);
    expect(repeatCount).toBe(0);

    // Audit recorded once with system identity
    const audit = await repository.listAudit();
    const systemAudits = audit.filter(
      (entry) =>
        entry.entityId === dueArtist.id &&
        entry.fromLifecycle === "scheduled" &&
        entry.toLifecycle === "published",
    );
    expect(systemAudits).toHaveLength(1);
    expect(systemAudits[0]).toMatchObject({
      entityType: "artist",
      entityId: dueArtist.id,
      fromLifecycle: "scheduled",
      toLifecycle: "published",
      actorEmail: "system@sunstrucksynapse.com",
      reason: "Scheduled publication",
      occurredAt: runTime,
    });
  });
});
