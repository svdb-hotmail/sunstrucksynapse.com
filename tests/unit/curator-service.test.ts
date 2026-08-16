import { beforeEach, describe, expect, it } from "vitest";

import { createE2eCuratorRepository } from "../../app/repositories/curator-fixture.server";
import type { CuratorEntity, CuratorRepository } from "../../app/repositories/curator.server";
import { CuratorService } from "../../app/services/curator.server";

const actor = { id: "access-subject-7", email: "curator@example.test" };

describe("curator catalogue management", () => {
  let repository: CuratorRepository;
  let service: CuratorService;

  beforeEach(() => {
    repository = createE2eCuratorRepository();
    service = new CuratorService(repository, () => new Date("2026-08-16T08:00:00Z"));
  });

  async function createCompleteTrack() {
    const artist = await service.create("artist", {
      slug: "test-artist",
      title: " Test Artist ",
    });
    expect(artist.ok).toBe(true);
    const release = await service.create("release", {
      slug: "test-release",
      title: "Test Release",
      artistId: artist.ok ? artist.value.id : "",
    });
    expect(release.ok).toBe(true);
    const track = await service.create("track", {
      slug: "test-track",
      title: "Test Track",
      artistId: artist.ok ? artist.value.id : "",
      releaseId: release.ok ? release.value.id : "",
      position: 1,
    });
    expect(track.ok).toBe(true);
    return {
      artist: artist.ok ? artist.value : null,
      release: release.ok ? release.value : null,
      track: track.ok ? track.value : null,
    };
  }

  it("creates and edits linked artists, releases, and tracks", async () => {
    const records = await createCompleteTrack();
    expect(records.artist?.title).toBe("Test Artist");

    const updated = await service.update("track", records.track!.id, {
      slug: "edited-track",
      title: " Edited Track ",
    });

    expect(updated).toMatchObject({
      ok: true,
      value: { slug: "edited-track", title: "Edited Track" },
    });
  });

  it("returns understandable duplicate and referential-integrity errors", async () => {
    const records = await createCompleteTrack();

    await expect(
      service.create("artist", { slug: "test-artist", title: "Duplicate Artist" }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "conflict", message: "The artist slug is already in use." },
    });
    await expect(service.delete("artist", records.artist!.id)).resolves.toEqual({
      ok: false,
      error: {
        code: "referenced",
        message: "Remove this artist's release and track credits before deleting it.",
      },
    });
  });

  it("requires valid linked records for catalogue relationships", async () => {
    const missing = crypto.randomUUID();

    await expect(
      service.create("track", {
        slug: "orphan",
        title: "Orphan",
        artistId: missing,
        releaseId: missing,
        position: 1,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "not_found", message: "The selected release no longer exists." },
    });
    await expect(service.addCollectionItem(missing, { trackId: missing })).resolves.toMatchObject({
      ok: false,
      error: { code: "not_found", message: "The collection no longer exists." },
    });
  });

  it("allows tracks in multiple collections and preserves deterministic ordering", async () => {
    const { track } = await createCompleteTrack();
    const secondTrack = await service.create("track", {
      slug: "second-track",
      title: "Second Track",
      artistId: (await repository.list("artist"))[0].id,
      releaseId: (await repository.list("release"))[0].id,
      position: 2,
    });
    const firstCollection = await service.create("collection", {
      slug: "first-shelf",
      title: "First Shelf",
    });
    const secondCollection = await service.create("collection", {
      slug: "second-shelf",
      title: "Second Shelf",
    });
    expect(secondTrack.ok && firstCollection.ok && secondCollection.ok).toBe(true);

    await service.addCollectionItem(firstCollection.ok ? firstCollection.value.id : "", {
      trackId: track!.id,
    });
    await service.addCollectionItem(firstCollection.ok ? firstCollection.value.id : "", {
      trackId: secondTrack.ok ? secondTrack.value.id : "",
    });
    await service.addCollectionItem(secondCollection.ok ? secondCollection.value.id : "", {
      trackId: track!.id,
    });
    await expect(
      service.addCollectionItem(firstCollection.ok ? firstCollection.value.id : "", {
        trackId: track!.id,
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "conflict", message: "That item is already in this collection." },
    });
    const original = await repository.listCollectionItems(
      firstCollection.ok ? firstCollection.value.id : "",
    );

    await expect(
      service.reorderCollection(
        firstCollection.ok ? firstCollection.value.id : "",
        original.map(({ id }) => id).reverse(),
      ),
    ).resolves.toEqual({ ok: true, value: null });
    expect(
      (
        await repository.listCollectionItems(firstCollection.ok ? firstCollection.value.id : "")
      ).map(({ trackId, position }) => ({ trackId, position })),
    ).toEqual([
      { trackId: secondTrack.ok ? secondTrack.value.id : "", position: 1 },
      { trackId: track!.id, position: 2 },
    ]);
    expect(
      await repository.listCollectionItems(secondCollection.ok ? secondCollection.value.id : ""),
    ).toHaveLength(1);
  });
});

describe("publication lifecycle", () => {
  it("enforces the linear lifecycle and records actor, time, and reason", async () => {
    const repository = createE2eCuratorRepository();
    const now = new Date("2026-08-16T08:00:00Z");
    const service = new CuratorService(repository, () => now);
    const created = await service.create("collection", {
      slug: "scheduled-shelf",
      title: "Scheduled Shelf",
    });
    const entity = (created as { ok: true; value: CuratorEntity }).value;

    await expect(
      service.transition("collection", entity.id, "published", actor, {
        reason: "Shortcut",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "invalid" } });
    await expect(
      service.transition("collection", entity.id, "in_review", actor),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      service.transition("collection", entity.id, "published", actor, {
        reason: "Still a shortcut",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "invalid" } });
    await expect(
      service.transition("collection", entity.id, "scheduled", actor, {
        scheduledFor: new Date("2026-08-17T08:00:00Z"),
      }),
    ).resolves.toMatchObject({ ok: true });

    const scheduler = new CuratorService(repository, () => new Date("2026-08-18T08:00:00Z"));
    await expect(scheduler.publishScheduled()).resolves.toBe(1);
    await expect(scheduler.publishScheduled()).resolves.toBe(0);
    await expect(scheduler.delete("collection", entity.id)).resolves.toEqual({
      ok: false,
      error: {
        code: "invalid",
        message: "Only draft or archived records can be deleted.",
      },
    });
    await expect(
      scheduler.transition("collection", entity.id, "archived", actor, {
        reason: "Season ended",
      }),
    ).resolves.toMatchObject({ ok: true });

    const audit = await repository.listAudit();
    expect(audit).toHaveLength(4);
    expect(audit[0]).toMatchObject({
      actorEmail: "curator@example.test",
      fromLifecycle: "published",
      toLifecycle: "archived",
      reason: "Season ended",
      occurredAt: new Date("2026-08-18T08:00:00Z"),
    });
    expect(audit[1]).toMatchObject({
      actorEmail: "system@sunstrucksynapse.com",
      fromLifecycle: "scheduled",
      toLifecycle: "published",
      reason: "Scheduled publication",
    });
  });

  it("requires future schedules and reasons for publication changes", async () => {
    const repository = createE2eCuratorRepository();
    const now = new Date("2026-08-16T08:00:00Z");
    const service = new CuratorService(repository, () => now);
    const created = await service.create("artist", {
      slug: "lifecycle-artist",
      title: "Lifecycle Artist",
    });
    const id = (created as { ok: true; value: CuratorEntity }).value.id;
    await service.transition("artist", id, "in_review", actor);

    await expect(
      service.transition("artist", id, "scheduled", actor, { scheduledFor: now }),
    ).resolves.toMatchObject({
      ok: false,
      error: { message: "Choose a future publication time." },
    });
  });

  it("publishes due records automatically while keeping future records scheduled without duplicate audits", async () => {
    const repository = createE2eCuratorRepository();
    const t0 = new Date("2026-08-16T08:00:00Z");
    const service = new CuratorService(repository, () => t0);

    const artist = await service.create("artist", {
      slug: "due-artist",
      title: "Due Artist",
    });
    const release = await service.create("release", {
      slug: "future-release",
      title: "Future Release",
      artistId: (artist as { ok: true; value: CuratorEntity }).value.id,
    });

    const artistId = (artist as { ok: true; value: CuratorEntity }).value.id;
    const releaseId = (release as { ok: true; value: CuratorEntity }).value.id;

    await service.transition("artist", artistId, "in_review", actor);
    await service.transition("artist", artistId, "scheduled", actor, {
      scheduledFor: new Date("2026-08-17T00:00:00Z"),
    });

    await service.transition("release", releaseId, "in_review", actor);
    await service.transition("release", releaseId, "scheduled", actor, {
      scheduledFor: new Date("2026-08-19T00:00:00Z"),
    });

    const schedulerAtT1 = new CuratorService(repository, () => new Date("2026-08-17T12:00:00Z"));
    const firstRunPublished = await schedulerAtT1.publishScheduled();
    expect(firstRunPublished).toBe(1);

    const publishedArtist = await repository.find("artist", artistId);
    expect(publishedArtist?.lifecycleStatus).toBe("published");
    expect(publishedArtist?.scheduledFor).toBeNull();

    const futureRelease = await repository.find("release", releaseId);
    expect(futureRelease?.lifecycleStatus).toBe("scheduled");
    expect(futureRelease?.scheduledFor).toEqual(new Date("2026-08-19T00:00:00Z"));

    const secondRunPublished = await schedulerAtT1.publishScheduled();
    expect(secondRunPublished).toBe(0);

    const audit = await repository.listAudit();
    const scheduledAudits = audit.filter(
      (entry) =>
        entry.entityId === artistId &&
        entry.fromLifecycle === "scheduled" &&
        entry.toLifecycle === "published",
    );
    expect(scheduledAudits).toHaveLength(1);
    expect(scheduledAudits[0]).toMatchObject({
      entityType: "artist",
      entityId: artistId,
      fromLifecycle: "scheduled",
      toLifecycle: "published",
      actorEmail: "system@sunstrucksynapse.com",
      reason: "Scheduled publication",
      occurredAt: new Date("2026-08-17T12:00:00Z"),
    });
  });
});
