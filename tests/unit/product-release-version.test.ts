import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { APP_VERSION } from "../../app/data/product-releases";

it("keeps the user-facing version aligned with the application and locked release metadata", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(
    readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"),
  );
  expect(APP_VERSION).toBe(manifest.version);
  expect(lock.version).toBe(APP_VERSION);
  expect(lock.packages[""].version).toBe(APP_VERSION);
});
