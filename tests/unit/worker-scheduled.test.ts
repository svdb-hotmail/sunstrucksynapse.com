import { describe, expect, it } from "vitest";

import worker, { e2eCuratorRepository } from "../../workers/app";
import { CuratorService } from "../../app/services/curator.server";

describe("Cloudflare Worker scheduled publication handler", () => {
  it("exports fetch and scheduled handlers matching ExportedHandler", () => {
    expect(typeof worker.fetch).toBe("function");
    expect(typeof worker.scheduled).toBe("function");
  });

  it("processes scheduled publications on cron trigger without curator Access authentication", async () => {
    const service = new CuratorService(
      e2eCuratorRepository,
      () => new Date("2026-08-16T08:00:00Z"),
    );
    const actor = { id: "curator-1", email: "curator@example.test" };

    const dueArtist = await service.create("artist", {
      slug: "worker-due-artist",
      title: "Worker Due Artist",
    });
    const futureArtist = await service.create("artist", {
      slug: "worker-future-artist",
      title: "Worker Future Artist",
    });

    const dueId = (dueArtist as { ok: true; value: { id: string } }).value.id;
    const futureId = (futureArtist as { ok: true; value: { id: string } }).value.id;

    await service.transition("artist", dueId, "in_review", actor);
    await service.transition("artist", dueId, "scheduled", actor, {
      scheduledFor: new Date("2026-08-16T09:00:00Z"),
    });

    await service.transition("artist", futureId, "in_review", actor);
    await service.transition("artist", futureId, "scheduled", actor, {
      scheduledFor: new Date("2026-08-16T15:00:00Z"),
    });

    // Invoke worker.scheduled at 2026-08-16T10:00:00Z without any HTTP Request or Access token
    const scheduledTime = Date.parse("2026-08-16T10:00:00Z");
    const controller = {
      scheduledTime,
      cron: "* * * * *",
      noRetry() {},
    };
    const mockEnv = {} as Env;
    const mockCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    // First scheduled execution
    await worker.scheduled(controller, mockEnv, mockCtx);

    // Verify worker.scheduled directly updated the worker's repository
    const published = await e2eCuratorRepository.find("artist", dueId);
    expect(published?.lifecycleStatus).toBe("published");
    expect(published?.scheduledFor).toBeNull();

    const future = await e2eCuratorRepository.find("artist", futureId);
    expect(future?.lifecycleStatus).toBe("scheduled");
    expect(future?.scheduledFor).toEqual(new Date("2026-08-16T15:00:00Z"));

    // Repeat execution at same timestamp -> no duplicates
    await worker.scheduled(controller, mockEnv, mockCtx);

    const audit = await e2eCuratorRepository.listAudit();
    const systemAudits = audit.filter(
      (row) => row.entityId === dueId && row.actorEmail === "system@sunstrucksynapse.com",
    );
    expect(systemAudits).toHaveLength(1);
    expect(systemAudits[0]).toMatchObject({
      entityType: "artist",
      entityId: dueId,
      fromLifecycle: "scheduled",
      toLifecycle: "published",
      reason: "Scheduled publication",
      occurredAt: new Date(scheduledTime),
    });
  });

  it("propagates environment validation errors during production scheduled runs", async () => {
    const originalMode = import.meta.env.MODE;
    try {
      import.meta.env.MODE = "production";
      const controller = {
        scheduledTime: Date.now(),
        cron: "* * * * *",
        noRetry() {},
      };
      const mockEnv = {} as Env;
      const mockCtx = {
        waitUntil: () => {},
        passThroughOnException: () => {},
      } as unknown as ExecutionContext;

      await expect(worker.scheduled(controller, mockEnv, mockCtx)).rejects.toThrow();
    } finally {
      import.meta.env.MODE = originalMode;
    }
  });

  it("preserves production fetch behavior", async () => {
    // When env validation fails in production mode, fetch returns 500 error response
    const originalMode = import.meta.env.MODE;
    try {
      import.meta.env.MODE = "production";
      const request = new Request("https://example.com/") as unknown as Parameters<
        NonNullable<typeof worker.fetch>
      >[0];
      const response = await worker.fetch(
        request,
        {} as Env,
        {
          waitUntil: () => {},
          passThroughOnException: () => {},
        } as unknown as ExecutionContext,
      );
      expect(response.status).toBe(500);
    } finally {
      import.meta.env.MODE = originalMode;
    }
  });
});
