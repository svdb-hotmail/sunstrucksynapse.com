import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

async function makeRun(): Promise<string> {
  const runDir = await mkdtemp(join(tmpdir(), "sunstruck-uat-report-"));
  temporaryDirectories.push(runDir);

  await mkdir(join(runDir, "screenshots", "raw"), { recursive: true });
  await mkdir(join(runDir, "screenshots", "annotated"), { recursive: true });
  await mkdir(join(runDir, "evidence", "metrics"), { recursive: true });

  await writeFile(
    join(runDir, "run.md"),
    [
      "# Run",
      "",
      "**Run ID:** 2026-08-24_deadbee_test",
      "**Deployment URL/environment:** https://example.test",
      "**Candidate commit SHA:** deadbeef",
      "**Chieftain recommendation:** ITERATE",
      "**Shaman / Warden acceptance evidence:** quality gate pending",
      "**Human maintainer decision:** STOP",
      "**Known residual risk / follow-up:** artwork retest required",
      "",
      "## Executive summary",
      "",
      "Catalogue navigation worked, while public artwork inheritance failed and one playback test remains unexecuted.",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    join(runDir, "notes.md"),
    "# Notes\n\nThe cover art is missing on the public track card.\n",
    "utf8",
  );

  await writeFile(
    join(runDir, "results.md"),
    [
      "# Results",
      "",
      "| ID | Status | Observed |",
      "| --- | --- | --- |",
      "| UAT-CAT-01 | PASS | Catalogue loaded |",
      "| UAT-CAT-02 | FAIL | Expected PASS artwork state was absent |",
      "| UAT-PB-01 | NOT_RUN | Not attempted |",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    join(runDir, "findings.md"),
    [
      "# Findings",
      "",
      "## UAT-F001 - Public track artwork fallback",
      "",
      "**Severity:** High",
      "**Type:** DEFECT",
      "**Next increment classification:** FIX",
      "**Definition of resolved:** Public track surfaces inherit the publishable release cover when no track-specific cover exists.",
      "**Acceptance criteria for retest:** UAT-CAT-02 shows the intended cover without duplicate upload.",
      "",
      "## Re-entry and regression plan",
      "",
      "- Retest UAT-CAT-02 and UAT-PB-01 after the next candidate is deployed.",
    ].join("\n"),
    "utf8",
  );

  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
    "base64",
  );
  await writeFile(join(runDir, "screenshots", "raw", "UAT-CAT-02_01_cover_raw.png"), onePixelPng);
  await writeFile(
    join(runDir, "screenshots", "annotated", "UAT-CAT-02_[cover]#1_annotated.png"),
    onePixelPng,
  );
  await writeFile(
    join(runDir, "evidence", "metrics", "playback-summary.json"),
    JSON.stringify({ attempts: 100, starts: 99, medianStartMs: 920 }),
    "utf8",
  );
  await writeFile(
    join(runDir, "evidence", "metrics", "metric`name.txt"),
    "sanitized metric evidence with a markdown-sensitive filename",
    "utf8",
  );

  return runDir;
}

function runGenerator(runDir: string) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/generate-uat-report.ts", runDir, "--html-only"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("generate-uat-report CLI", () => {
  it("renders governed, contract-complete Markdown and self-contained HTML", async () => {
    const runDir = await makeRun();
    const result = runGenerator(runDir);

    expect(result.status, result.stderr).toBe(0);

    const reportDir = join(runDir, "report");
    const markdown = await readFile(join(reportDir, "uat-report.md"), "utf8");
    const html = await readFile(join(reportDir, "uat-report.html"), "utf8");

    expect(markdown).toContain("**Run ID:** 2026-08-24_deadbee_test");
    expect(markdown).toContain("| PASS | 1 |");
    expect(markdown).toContain("| FAIL | 1 |");
    expect(markdown).toContain("| NOT_RUN | 1 |");
    expect(markdown).toContain("## Executive summary");
    expect(markdown).toContain("## Metrics and report-safe supporting evidence");
    expect(markdown).toContain("## Unexecuted / blocked / deferred coverage");
    expect(markdown).toContain("## Re-entry and regression plan");
    expect(markdown).toContain("## Decision record");
    expect(markdown).toContain("UAT-F001");
    expect(markdown).toContain("UAT-CAT-02_\\[cover\\]\\#1_annotated\\.png");
    expect(markdown).toContain("%23");
    expect(markdown).toContain("metric\\`name.txt");
    expect(markdown).toContain('"starts":99');

    expect(html).toContain("Sunstruck Synapse UAT Report");
    expect(html).toContain("Chieftain recommendation");
    expect(html).toContain("data:image/png;base64,");
    expect(html).toContain("UAT-F001");
    expect(html).toContain("medianStartMs");
    expect(html).toContain("sanitized metric evidence");
    expect(html).toContain("screenshots/raw/UAT-CAT-02_01_cover_raw.png");
    expect(html).not.toContain("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC</code>");
  });

  it("refuses to generate a final-looking report when a source ledger file is missing", async () => {
    const runDir = await makeRun();
    await rm(join(runDir, "findings.md"));

    const result = runGenerator(runDir);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing required ledger file(s): findings.md");
  });

  it("refuses to generate when a mandatory report source section is missing", async () => {
    const runDir = await makeRun();
    await writeFile(join(runDir, "findings.md"), "# Findings\n\nNo re-entry plan.\n", "utf8");

    const result = runGenerator(runDir);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("findings.md -> Re-entry and regression plan");
  });
});
