import { describe, expect, it } from "vitest";

import { validateDatabaseEnv } from "../../app/config/env.server";

describe("validateDatabaseEnv", () => {
  it.each(["postgres://user:pass@db.example.test/app", "postgresql://localhost/app"])(
    "accepts a valid PostgreSQL URL using %s",
    (DATABASE_URL) => {
      const env = validateDatabaseEnv({ DATABASE_URL });

      expect(env).toEqual({ DATABASE_URL });
      expect(Object.isFrozen(env)).toBe(true);
    },
  );

  it.each([
    [{}, "DATABASE_URL is required."],
    [{ DATABASE_URL: "   " }, "DATABASE_URL is required."],
    [{ DATABASE_URL: "not-a-url" }, "DATABASE_URL must be a valid PostgreSQL connection URL."],
    [
      { DATABASE_URL: "https://db.example.test/app" },
      "DATABASE_URL must be a valid PostgreSQL connection URL.",
    ],
  ])("rejects an invalid environment", (source, expectedMessage) => {
    expect(() => validateDatabaseEnv(source)).toThrow(expectedMessage);
  });
});
