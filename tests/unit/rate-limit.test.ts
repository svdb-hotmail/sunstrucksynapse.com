import { describe, expect, it } from "vitest";

import { createMemoryRateLimitRepository } from "../../app/repositories/rate-limit.server";

describe("request rate limits", () => {
  it("allows requests through the limit and returns a retry window after it", async () => {
    const repository = createMemoryRateLimitRepository();
    const now = new Date("2026-08-19T12:00:10.000Z");

    await expect(repository.consume("submission", "a".repeat(64), 2, 60, now)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 50,
    });
    await expect(repository.consume("submission", "a".repeat(64), 2, 60, now)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 50,
    });
    await expect(repository.consume("submission", "a".repeat(64), 2, 60, now)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 50,
    });
  });

  it("isolates scopes and aligned windows", async () => {
    const repository = createMemoryRateLimitRepository();
    const key = "b".repeat(64);
    await repository.consume("analytics", key, 1, 60, new Date("2026-08-19T12:00:59.000Z"));
    await expect(
      repository.consume("analytics", key, 1, 60, new Date("2026-08-19T12:01:00.000Z")),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      repository.consume("submission", key, 1, 60, new Date("2026-08-19T12:00:59.000Z")),
    ).resolves.toMatchObject({ allowed: true });
  });
});
