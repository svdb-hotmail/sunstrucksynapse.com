import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
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

  it("keeps pre-MVP validation without browser journeys or preview design baselines", () => {
    expect(workflow).toMatch(/push:\s+branches:\s+- main/);
    expect(workflow).toContain("name: quality-gate");
    const commands = packageJson.scripts.ci.split(" && ");
    for (const script of [
      "format:check",
      "lint",
      "typecheck",
      "test:unit",
      "test:encoder",
      "db:validate:local",
      "build",
    ]) {
      expect(commands).toContain(`npm run ${script}`);
      expect(workflow).toContain(`run: npm run ${script}`);
    }
    for (const script of [
      "test:e2e",
      "test:site-preview",
      "build-storybook",
      "build:site-preview",
    ]) {
      expect(commands).not.toContain(`npm run ${script}`);
      expect(workflow).not.toContain(`run: npm run ${script}`);
      expect(packageJson.scripts[script]).toBeTruthy();
    }
    expect(workflow).not.toContain("playwright install");
    // Stacked PRs must receive the same validation as PRs targeting main.
    expect(workflow.split("  push:")[0]).not.toContain("branches:");
  });

  it("grants minimum CodeQL permissions including actions: read and does not suppress CodeQL failure", () => {
    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("security-events: write");
    expect(workflow).not.toContain("continue-on-error");
    const [qualityJob, securityJob] = workflow.split("  quality-gate:");
    expect(qualityJob).not.toContain("github/codeql-action");
    expect(securityJob).toContain("npm audit --audit-level=high");
    // Preserve the CodeQL analysis key used by the repository's merge rules.
    expect(securityJob).toContain("github/codeql-action/analyze@v4");
    expect(securityJob).toContain("name: security");
  });
});
