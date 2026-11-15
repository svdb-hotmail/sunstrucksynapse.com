import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("production scheduled artwork palette dispatch", () => {
  const initialMode = import.meta.env.MODE;
  const mockedModules = [
    "../../app/db/client.server",
    "../../app/repositories/curator.server",
    "../../app/repositories/analytics.server",
    "../../app/repositories/rate-limit.server",
    "../../app/repositories/curation-workflow.server",
    "../../app/services/transactional-email.server",
    "../../app/services/curation-outbox-dispatch.server",
    "../../app/services/release-preparation.server",
    "../../app/services/artwork-palette-generation.server",
  ];

  afterEach(() => {
    import.meta.env.MODE = initialMode;
    for (const module of mockedModules) vi.doUnmock(module);
    vi.resetModules();
  });

  async function productionFixture(prepareAudio: () => Promise<unknown>) {
    vi.resetModules();
    import.meta.env.MODE = "production";
    const database = { localFixture: true };
    const mocks = {
      createDatabase: vi.fn((_env: unknown) => database),
      publishScheduled: vi.fn(async (_now: Date) => undefined),
      purgeAnalytics: vi.fn(async (_before: Date) => undefined),
      purgeRateLimits: vi.fn(async (_before: Date) => undefined),
      abandonUploads: vi.fn(async (_now: Date) => undefined),
      dispatch: vi.fn(async (..._args: unknown[]) => ({ claimed: 0, completed: 0 })),
      audio: vi.fn(async (_db: unknown, _env: unknown) => prepareAudio()),
      palette: vi.fn(async (_db: unknown, _env: unknown) => ({ state: "idle" })),
    };
    vi.doMock("../../app/db/client.server", () => ({ createDatabase: mocks.createDatabase }));
    vi.doMock("../../app/repositories/curator.server", async () => ({
      ...(await vi.importActual<Record<string, unknown>>("../../app/repositories/curator.server")),
      createCuratorRepository: () => ({ publishScheduled: mocks.publishScheduled }),
    }));
    vi.doMock("../../app/repositories/analytics.server", async () => ({
      ...(await vi.importActual<Record<string, unknown>>(
        "../../app/repositories/analytics.server",
      )),
      createAnalyticsRepository: () => ({ purgeBefore: mocks.purgeAnalytics }),
    }));
    vi.doMock("../../app/repositories/rate-limit.server", async () => ({
      ...(await vi.importActual<Record<string, unknown>>(
        "../../app/repositories/rate-limit.server",
      )),
      createRateLimitRepository: () => ({ purgeBefore: mocks.purgeRateLimits }),
    }));
    vi.doMock("../../app/repositories/curation-workflow.server", async () => ({
      ...(await vi.importActual<Record<string, unknown>>(
        "../../app/repositories/curation-workflow.server",
      )),
      createCurationWorkflowRepository: () => ({
        abandonExpiredAudioUploads: mocks.abandonUploads,
      }),
    }));
    vi.doMock("../../app/services/transactional-email.server", () => ({
      createTransactionalEmailService: () => ({ send: async () => undefined }),
    }));
    vi.doMock("../../app/services/curation-outbox-dispatch.server", () => ({
      dispatchCurationOutbox: mocks.dispatch,
    }));
    vi.doMock("../../app/services/release-preparation.server", () => ({
      prepareNextRelease: mocks.audio,
    }));
    vi.doMock("../../app/services/artwork-palette-generation.server", () => ({
      prepareNextArtworkPalette: mocks.palette,
    }));
    const productionWorker = (await import("../../workers/app")).default;
    const rawEnv = {
      DATABASE_URL: "postgres://unused/local-fixture",
      ACCESS_TEAM_DOMAIN: "https://fixture.cloudflareaccess.com/",
      ACCESS_AUD: " fixture-audience ",
      CURATOR_EMAILS: " curator@example.test ",
      MEDIA_DELIVERY_SIGNING_SECRET: " fixture-secret ",
      MEDIA_BUCKET: { get: async () => null },
      AUDIO_ENCODER: { fetch: async () => Response.json({}) },
    };
    const controller = {
      scheduledTime: Date.parse("2026-11-15T12:00:00Z"),
      cron: "* * * * *",
      noRetry() {},
    };
    const context = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
    return { productionWorker, database, mocks, rawEnv, controller, context };
  }

  it("passes validated environment to palette preparation only after audio finishes", async () => {
    let audioStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      audioStarted = resolve;
    });
    let finishAudio!: () => void;
    const released = new Promise<void>((resolve) => {
      finishAudio = resolve;
    });
    const fixture = await productionFixture(async () => {
      audioStarted();
      await released;
    });
    const execution = fixture.productionWorker.scheduled(
      fixture.controller,
      fixture.rawEnv as unknown as Env,
      fixture.context,
    );
    await started;
    try {
      expect(fixture.mocks.audio).toHaveBeenCalledTimes(1);
      expect(fixture.mocks.palette).not.toHaveBeenCalled();
      const validatedEnv = fixture.mocks.createDatabase.mock.calls[0][0];
      expect(validatedEnv).not.toBe(fixture.rawEnv);
      expect(Object.isFrozen(validatedEnv)).toBe(true);
      expect(validatedEnv).toMatchObject({
        ACCESS_TEAM_DOMAIN: "https://fixture.cloudflareaccess.com",
        ACCESS_AUD: "fixture-audience",
        CURATOR_EMAILS: "curator@example.test",
        MEDIA_DELIVERY_SIGNING_SECRET: "fixture-secret",
        MEDIA_BUCKET: fixture.rawEnv.MEDIA_BUCKET,
        AUDIO_ENCODER: fixture.rawEnv.AUDIO_ENCODER,
      });
      expect(fixture.mocks.audio).toHaveBeenCalledWith(fixture.database, validatedEnv);
    } finally {
      finishAudio();
    }
    await execution;
    const validatedEnv = fixture.mocks.createDatabase.mock.calls[0][0];
    expect(fixture.mocks.palette).toHaveBeenCalledExactlyOnceWith(fixture.database, validatedEnv);
    expect(fixture.mocks.abandonUploads).toHaveBeenCalledWith(
      new Date(fixture.controller.scheduledTime),
    );
    expect(fixture.mocks.dispatch).toHaveBeenCalledWith(
      fixture.database,
      expect.any(Object),
      fixture.rawEnv.MEDIA_BUCKET,
      new Date(fixture.controller.scheduledTime),
    );
  });

  it("never starts palette preparation when audio preparation throws", async () => {
    const failure = new Error("AUDIO_PREPARATION_INTERRUPTED");
    const fixture = await productionFixture(async () => {
      throw failure;
    });
    await expect(
      fixture.productionWorker.scheduled(
        fixture.controller,
        fixture.rawEnv as unknown as Env,
        fixture.context,
      ),
    ).rejects.toBe(failure);
    expect(fixture.mocks.audio).toHaveBeenCalledTimes(1);
    expect(fixture.mocks.palette).not.toHaveBeenCalled();
    expect(fixture.mocks.publishScheduled).toHaveBeenCalledTimes(1);
    expect(fixture.mocks.dispatch).toHaveBeenCalledTimes(1);
  });
});
