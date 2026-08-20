import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const qualityGateScript = readFileSync(
  new URL("../../.github/scripts/village-ci.sh", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };

describe("CI quality-gate lifecycle", () => {
  it("observes every event needed for Draft quarantine and Ready validation", () => {
    expect(workflow).toContain(
      "types: [converted_to_draft, opened, ready_for_review, synchronize, reopened]",
    );
    expect(workflow).toContain(
      "if: ${{ github.event_name == 'push' || github.event.pull_request.draft == false }}",
    );
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
  });

  it("preserves the main quality gate and complete local CI including E2E", () => {
    expect(workflow).toMatch(/push:\s+branches:\s+- main/);
    expect(workflow).toContain("name: quality-gate");
    expect(qualityGateScript).toContain("npm ci --no-audit --no-fund");
    expect(qualityGateScript).toContain("npx playwright install --with-deps chromium");
    expect(qualityGateScript).toContain("npm audit --audit-level=high");
    expect(workflow).not.toContain("github/codeql-action");
    expect(qualityGateScript).toContain("npm run ci");
    expect(packageJson.scripts.ci).toContain("npm run test:e2e");
  });

  it("defers CodeQL to repository default setup without an incompatible advanced upload", () => {
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("github/codeql-action");
    expect(workflow).not.toContain("continue-on-error");
  });
});
