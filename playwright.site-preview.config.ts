import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

export default defineConfig({
  testDir: "./tests/site-preview",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4175" },
  webServer: {
    command: `"${resolve("node_modules/.bin/wrangler")}" pages dev "${resolve("storybook-static")}" --port 4175 --compatibility-date 2026-08-14`,
    cwd: tmpdir(),
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
