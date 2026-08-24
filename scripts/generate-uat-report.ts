import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser } from "@playwright/test";

const REQUIRED_LEDGER_FILES = ["run.md", "notes.md", "results.md", "findings.md"] as const;
const RESULT_STATUSES = ["PASS", "FAIL", "BLOCKED", "DEFERRED", "NOT_RUN"] as const;
const REPORT_SAFE_TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".csv", ".log"]);
const MAX_EMBEDDED_EVIDENCE_BYTES = 128 * 1024;

type ResultStatus = (typeof RESULT_STATUSES)[number];

type ReportInputs = {
  run: string;
  notes: string;
  results: string;
  findings: string;
};

type StatusSummary = Record<ResultStatus, number>;

type ResultRecord = {
  id: string;
  status: ResultStatus;
  sourceLine: string;
};

type ReportMetadata = {
  runId: string;
  environment: string;
  candidate: string;
  humanDecision: string;
  chieftainRecommendation: string;
  shamanWardenEvidence: string;
  acceptedRisk: string;
};

type EmbeddedEvidence = {
  relativePath: string;
  content: string;
};

function usage(): void {
  console.error("Usage: npm run uat:report -- test-results/uat/<RUN_ID> [--html-only]");
  process.exit(2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayPath(value: string): string {
  return value.replaceAll("\r", "\\r").replaceAll("\n", "\\n").replaceAll("\t", "\\t");
}

function escapeMarkdownText(value: string): string {
  return displayPath(value).replace(/([\\`*_[\]{}()<>#+.!|\-])/g, "\\$1");
}

function escapeMarkdownListText(value: string): string {
  return displayPath(value).replace(/([\\`*_[\]<>#|])/g, "\\$1");
}

function markdownLinkTarget(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function renderInline(value: string): string {
  let rendered = escapeHtml(value);
  rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>");
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  rendered = rendered.replace(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  return rendered;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(" ", "")));
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const output: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let codeFence = false;
  let codeLanguage = "";
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  };

  const flushCode = () => {
    const className = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : "";
    output.push(`<pre><code${className}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
    codeLanguage = "";
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trimStart().startsWith("```")) {
      flushParagraph();
      closeList();
      if (codeFence) {
        flushCode();
        codeFence = false;
      } else {
        codeLanguage = line.trim().slice(3).trim();
        codeFence = true;
      }
      continue;
    }
    if (codeFence) {
      codeLines.push(line);
      continue;
    }
    if (
      line.trim().startsWith("|") &&
      index + 1 < lines.length &&
      isTableDivider(lines[index + 1] ?? "")
    ) {
      flushParagraph();
      closeList();
      const headers = splitTableRow(line);
      output.push('<div class="table-wrap"><table><thead><tr>');
      output.push(headers.map((header) => `<th>${renderInline(header)}</th>`).join(""));
      output.push("</tr></thead><tbody>");
      index += 2;
      while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
        const cells = splitTableRow(lines[index] ?? "");
        output.push("<tr>");
        output.push(cells.map((cell) => `<td>${renderInline(cell)}</td>`).join(""));
        output.push("</tr>");
        index += 1;
      }
      output.push("</tbody></table></div>");
      index -= 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1]?.length ?? 2;
      output.push(`<h${level}>${renderInline(heading[2] ?? "")}</h${level}>`);
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) {
      flushParagraph();
      closeList();
      output.push("<hr>");
      continue;
    }
    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const desiredType: "ul" | "ol" = unordered ? "ul" : "ol";
      if (listType !== desiredType) {
        closeList();
        output.push(`<${desiredType}>`);
        listType = desiredType;
      }
      let item = unordered?.[1] ?? ordered?.[1] ?? "";
      const checkbox = /^\[([ xX])]\s*(.*)$/.exec(item);
      if (checkbox) {
        const mark = checkbox[1]?.toLowerCase() === "x" ? "☑" : "☐";
        item = `${mark} ${checkbox[2] ?? ""}`;
      }
      output.push(`<li>${renderInline(item)}</li>`);
      continue;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      closeList();
      output.push(`<blockquote>${renderInline(quote[1] ?? "")}</blockquote>`);
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }
    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  if (codeFence) flushCode();
  return output.join("\n");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root: string): Promise<string[]> {
  if (!(await fileExists(root))) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function relativePortable(from: string, to: string): string {
  return relative(from, to).replaceAll("\\", "/");
}

function extractField(markdown: string, label: string): string {
  const escapedLabel = escapeRegExp(label);
  const patterns = [
    new RegExp(`^\\s*(?:[-*]\\s*)?\\*\\*${escapedLabel}:\\*\\*\\s*(.+?)\\s*$`, "im"),
    new RegExp(`^\\s*(?:[-*]\\s*)?\\*\\*${escapedLabel}\\*\\*\\s*:\\s*(.+?)\\s*$`, "im"),
    new RegExp(`^\\s*(?:[-*]\\s*)?${escapedLabel}\\s*:\\s*(.+?)\\s*$`, "im"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(markdown);
    if (match?.[1]) return match[1].replace(/^`|`$/g, "").trim();
  }
  return "Not recorded";
}

function extractSection(markdown: string, acceptedHeadings: string[]): string | null {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index] ?? "");
    if (!match) continue;
    const heading = (match[2] ?? "").replace(/[*_`]/g, "").trim().toLowerCase();
    if (!acceptedHeadings.some((candidate) => heading === candidate.toLowerCase())) continue;
    const level = match[1]?.length ?? 6;
    const body: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const nextHeading = /^(#{1,6})\s+/.exec(lines[cursor] ?? "");
      if (nextHeading && (nextHeading[1]?.length ?? 7) <= level) break;
      body.push(lines[cursor] ?? "");
    }
    return body.join("\n").trim();
  }
  return null;
}

function metadataFrom(inputs: ReportInputs): ReportMetadata {
  const combined = `${inputs.run}\n${inputs.results}\n${inputs.findings}`;
  const deployment = extractField(inputs.run, "Deployment URL/environment");
  const candidate = extractField(inputs.run, "Candidate commit SHA");
  const chieftain = extractField(combined, "Chieftain recommendation");
  return {
    runId: extractField(inputs.run, "Run ID"),
    environment:
      deployment === "Not recorded" ? extractField(inputs.run, "Environment") : deployment,
    candidate: candidate === "Not recorded" ? extractField(inputs.run, "Candidate") : candidate,
    humanDecision: extractField(combined, "Human maintainer decision"),
    chieftainRecommendation:
      chieftain === "Not recorded" ? extractField(combined, "DevAI recommendation") : chieftain,
    shamanWardenEvidence: extractField(combined, "Shaman / Warden acceptance evidence"),
    acceptedRisk: extractField(combined, "Known residual risk / follow-up"),
  };
}

function parseResultRecords(results: string): ResultRecord[] {
  const lines = results.replaceAll("\r\n", "\n").split("\n");
  const byTestId = new Map<string, ResultRecord>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (
      !line.trim().startsWith("|") ||
      index + 1 >= lines.length ||
      !isTableDivider(lines[index + 1] ?? "")
    ) {
      continue;
    }
    const headers = splitTableRow(line).map((cell) =>
      cell.replace(/[*_`]/g, "").trim().toLowerCase(),
    );
    const statusIndex = headers.findIndex((cell) => cell === "status" || cell === "result");
    const testIndex = headers.findIndex(
      (cell) => cell === "test" || cell === "test id" || cell === "uat id" || cell === "id",
    );
    if (statusIndex < 0 || testIndex < 0) continue;
    index += 2;
    while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
      const cells = splitTableRow(lines[index] ?? "");
      const id = /\bUAT-[A-Z0-9-]+\b/i.exec(cells[testIndex] ?? "")?.[0]?.toUpperCase();
      const status = (cells[statusIndex] ?? "").replace(/[*_`]/g, "").trim().toUpperCase();
      if (id && RESULT_STATUSES.includes(status as ResultStatus)) {
        byTestId.set(id, { id, status: status as ResultStatus, sourceLine: lines[index] ?? "" });
      }
      index += 1;
    }
    index -= 1;
  }
  let currentTestId: string | null = null;
  for (const line of lines) {
    const id = /\bUAT-[A-Z0-9-]+\b/i.exec(line)?.[0]?.toUpperCase();
    if (id) currentTestId = id;
    if (!currentTestId) continue;
    const match =
      /(?:^|\s)(?:\*\*)?Status(?:\*\*)?\s*:\s*(PASS|FAIL|BLOCKED|DEFERRED|NOT_RUN)\b/i.exec(line);
    if (match?.[1]) {
      byTestId.set(currentTestId, {
        id: currentTestId,
        status: match[1].toUpperCase() as ResultStatus,
        sourceLine: line,
      });
    }
  }
  return [...byTestId.values()];
}

function statusSummaryFromRecords(records: ResultRecord[]): StatusSummary {
  const summary = Object.fromEntries(RESULT_STATUSES.map((status) => [status, 0])) as StatusSummary;
  for (const record of records) summary[record.status] += 1;
  return summary;
}

function imageMime(path: string): string | null {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

async function imageDataUri(path: string): Promise<string | null> {
  const mime = imageMime(path);
  if (!mime) return null;
  const base64 = await readFile(path, "base64");
  return `data:${mime};base64,${base64}`;
}

function statusSummaryMarkdown(summary: StatusSummary): string {
  return [
    "| Status | Count |",
    "| --- | ---: |",
    ...RESULT_STATUSES.map((status) => `| ${status} | ${summary[status]} |`),
  ].join("\n");
}

function evidenceManifestMarkdown(runDir: string, evidenceFiles: string[]): string {
  if (evidenceFiles.length === 0) return "No supporting evidence files were found.";
  return evidenceFiles
    .map((path) => `- ${escapeMarkdownListText(relativePortable(runDir, path))}`)
    .join("\n");
}

function screenshotMarkdown(reportDir: string, screenshots: string[]): string {
  if (screenshots.length === 0) {
    return "No annotated screenshots were present when this report was generated.";
  }
  return screenshots
    .map((path) => {
      const name = escapeMarkdownText(basename(path));
      const target = markdownLinkTarget(relativePortable(reportDir, path));
      return `### ${name}\n\n![Annotated UAT evidence: ${name}](${target})`;
    })
    .join("\n\n");
}

function incompleteCoverageMarkdown(records: ResultRecord[]): string {
  const incomplete = records.filter((record) =>
    ["BLOCKED", "DEFERRED", "NOT_RUN"].includes(record.status),
  );
  if (incomplete.length === 0) {
    return "No required tests are recorded as BLOCKED, DEFERRED, or NOT_RUN.";
  }
  return [
    "| Test | Status | Recorded source |",
    "| --- | --- | --- |",
    ...incomplete.map(
      (record) =>
        `| ${record.id} | ${record.status} | ${escapeMarkdownText(record.sourceLine.trim())} |`,
    ),
  ].join("\n");
}

async function collectReportSafeEvidence(
  runDir: string,
  evidenceFiles: string[],
): Promise<EmbeddedEvidence[]> {
  const embedded: EmbeddedEvidence[] = [];
  for (const path of evidenceFiles) {
    if (!REPORT_SAFE_TEXT_EXTENSIONS.has(extname(path).toLowerCase())) continue;
    if ((await stat(path)).size > MAX_EMBEDDED_EVIDENCE_BYTES) continue;
    embedded.push({
      relativePath: relativePortable(runDir, path),
      content: await readFile(path, "utf8"),
    });
  }
  return embedded;
}

function evidenceMarkdown(evidence: EmbeddedEvidence[]): string {
  if (evidence.length === 0) {
    return "No report-safe text metrics/log evidence was available for embedding. See the evidence appendix.";
  }
  return evidence
    .map(({ relativePath, content }) => {
      const indented = content
        .replaceAll("\r\n", "\n")
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
      return `### ${escapeMarkdownText(relativePath)}\n\n${indented || "    (empty file)"}`;
    })
    .join("\n\n");
}

function evidenceHtml(evidence: EmbeddedEvidence[]): string {
  if (evidence.length === 0) {
    return '<p class="empty">No report-safe text metrics/log evidence was available for embedding. See the evidence appendix.</p>';
  }
  return evidence
    .map(
      ({ relativePath, content }) =>
        `<article class="evidence-text"><h3>${escapeHtml(displayPath(relativePath))}</h3><pre><code>${escapeHtml(content)}</code></pre></article>`,
    )
    .join("\n");
}

function decisionRecordMarkdown(metadata: ReportMetadata): string {
  return [
    `- **Chieftain recommendation:** ${metadata.chieftainRecommendation}`,
    `- **Shaman / Warden acceptance evidence:** ${metadata.shamanWardenEvidence}`,
    `- **Human maintainer decision:** ${metadata.humanDecision}`,
    `- **Known residual risk / follow-up:** ${metadata.acceptedRisk}`,
  ].join("\n");
}

function buildReportMarkdown(options: {
  inputs: ReportInputs;
  metadata: ReportMetadata;
  statusSummary: StatusSummary;
  resultRecords: ResultRecord[];
  executiveSummary: string;
  reentryPlan: string;
  reportDir: string;
  screenshots: string[];
  evidenceFiles: string[];
  reportSafeEvidence: EmbeddedEvidence[];
  runDir: string;
  generatedAt: string;
}): string {
  const {
    inputs,
    metadata,
    statusSummary,
    resultRecords,
    executiveSummary,
    reentryPlan,
    reportDir,
    screenshots,
    evidenceFiles,
    reportSafeEvidence,
    runDir,
    generatedAt,
  } = options;
  return `# Sunstruck Synapse UAT Report

**Run ID:** ${metadata.runId}  
**Environment:** ${metadata.environment}  
**Candidate:** ${metadata.candidate}  
**Generated:** ${generatedAt}

> Generated deterministically from the preserved UAT run ledger. Source observations remain authoritative; automated green never converts incomplete UAT coverage into a pass.

## Executive summary

${executiveSummary}

## Result summary

${statusSummaryMarkdown(statusSummary)}

## Run identity and context

${inputs.run}

## Journey / test results

${inputs.results}

## Detailed findings and next increment definitions

${inputs.findings}

## Annotated screenshot evidence

${screenshotMarkdown(reportDir, screenshots)}

## Metrics and report-safe supporting evidence

${evidenceMarkdown(reportSafeEvidence)}

## Unexecuted / blocked / deferred coverage

${incompleteCoverageMarkdown(resultRecords)}

## Re-entry and regression plan

${reentryPlan}

## Decision record

${decisionRecordMarkdown(metadata)}

## Chronological tester notes

${inputs.notes}

## Evidence appendix

${evidenceManifestMarkdown(runDir, evidenceFiles)}
`;
}

async function buildScreenshotHtml(screenshots: string[]): Promise<string> {
  if (screenshots.length === 0) {
    return '<p class="empty">No annotated screenshots were present when this report was generated.</p>';
  }
  const blocks: string[] = [];
  for (const path of screenshots) {
    const uri = await imageDataUri(path);
    if (!uri) continue;
    const name = displayPath(basename(path));
    blocks.push(`
      <figure class="evidence-plate">
        <figcaption>${escapeHtml(name)}</figcaption>
        <img src="${uri}" alt="Annotated UAT evidence: ${escapeHtml(name)}">
      </figure>
    `);
  }
  return blocks.length > 0
    ? blocks.join("\n")
    : '<p class="empty">No supported annotated screenshot files were found.</p>';
}

function statusCards(summary: StatusSummary): string {
  return RESULT_STATUSES.map(
    (status) => `
      <div class="status-card status-${status.toLowerCase().replace("_", "-")}">
        <div class="status-count">${summary[status]}</div>
        <div class="status-label">${status}</div>
      </div>`,
  ).join("\n");
}

function buildHtml(options: {
  inputs: ReportInputs;
  metadata: ReportMetadata;
  statusSummary: StatusSummary;
  resultRecords: ResultRecord[];
  executiveSummary: string;
  reentryPlan: string;
  screenshotHtml: string;
  evidenceFiles: string[];
  reportSafeEvidence: EmbeddedEvidence[];
  runDir: string;
  generatedAt: string;
}): string {
  const {
    inputs,
    metadata,
    statusSummary,
    resultRecords,
    executiveSummary,
    reentryPlan,
    screenshotHtml,
    evidenceFiles,
    reportSafeEvidence,
    runDir,
    generatedAt,
  } = options;
  const manifest =
    evidenceFiles.length === 0
      ? '<p class="empty">No supporting evidence files were found.</p>'
      : `<ul>${evidenceFiles
          .map((path) => `<li>${escapeHtml(displayPath(relativePortable(runDir, path)))}</li>`)
          .join("")}</ul>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sunstruck Synapse UAT Report — ${escapeHtml(metadata.runId)}</title>
<style>
  :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; color: #172033; background: #eef1f5; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef1f5; }
  main { width: min(1100px, calc(100% - 40px)); margin: 32px auto; }
  .cover, section { background: #fff; border: 1px solid #dce2ea; border-radius: 12px; padding: 32px; margin-bottom: 22px; }
  .cover { min-height: 360px; display: flex; flex-direction: column; justify-content: space-between; }
  .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; font-weight: 700; color: #586174; }
  h1 { font-size: 36px; line-height: 1.1; margin: 10px 0 18px; }
  h2 { font-size: 24px; margin-top: 0; border-bottom: 1px solid #e5e9ef; padding-bottom: 10px; }
  h3 { font-size: 18px; margin-top: 26px; }
  h4, h5, h6 { margin-top: 20px; }
  p, li, td, th { font-size: 14px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .92em; background: #f3f5f8; padding: .12em .35em; border-radius: 4px; }
  pre { overflow-wrap: anywhere; white-space: pre-wrap; background: #f6f8fa; border: 1px solid #e1e6ed; border-radius: 8px; padding: 14px; }
  pre code { background: transparent; padding: 0; }
  blockquote { margin: 18px 0; padding: 10px 16px; border-left: 4px solid #74809a; background: #f7f8fb; }
  .meta-grid { display: grid; grid-template-columns: 190px 1fr; gap: 8px 18px; margin-top: 28px; }
  .meta-label { color: #697386; font-weight: 600; }
  .decision { font-weight: 800; }
  .status-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 18px 0; }
  .status-card { border: 1px solid #dce2ea; border-radius: 8px; padding: 14px; text-align: center; background: #fafbfd; }
  .status-count { font-size: 28px; font-weight: 800; line-height: 1; }
  .status-label { margin-top: 7px; font-size: 11px; font-weight: 700; letter-spacing: .05em; }
  .table-wrap { overflow-x: auto; margin: 14px 0 20px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #dfe4eb; padding: 8px 9px; vertical-align: top; text-align: left; }
  th { background: #f2f4f7; }
  .evidence-plate, .evidence-text { break-inside: avoid; margin: 0 0 28px; }
  .evidence-plate figcaption { font-size: 12px; font-weight: 700; padding: 9px 12px; background: #f2f4f7; border-bottom: 1px solid #dfe4eb; }
  .evidence-plate img { display: block; width: 100%; height: auto; }
  .empty { color: #6d7585; font-style: italic; }
  a { color: #1f5e9c; word-break: break-all; }
  hr { border: 0; border-top: 1px solid #e4e8ee; margin: 24px 0; }
  @media print {
    @page { size: A4; margin: 14mm 13mm 16mm; }
    body { background: #fff; }
    main { width: 100%; margin: 0; }
    .cover, section { border: 0; border-radius: 0; padding: 0; margin: 0 0 10mm; }
    .cover { min-height: 245mm; break-after: page; }
    section { break-before: page; }
    h2, h3 { break-after: avoid; }
    table, pre, blockquote, .status-grid { break-inside: avoid; }
    .evidence-plate, .evidence-text { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <article class="cover">
    <div>
      <div class="eyebrow">User Acceptance Test</div>
      <h1>Sunstruck Synapse UAT Report</h1>
      <p>Evidence-first checkpoint report generated from the preserved run ledger.</p>
    </div>
    <div class="meta-grid">
      <div class="meta-label">Run ID</div><div>${escapeHtml(metadata.runId)}</div>
      <div class="meta-label">Environment</div><div>${escapeHtml(metadata.environment)}</div>
      <div class="meta-label">Candidate</div><div><code>${escapeHtml(metadata.candidate)}</code></div>
      <div class="meta-label">Generated</div><div>${escapeHtml(generatedAt)}</div>
      <div class="meta-label">Chieftain recommendation</div><div class="decision">${escapeHtml(metadata.chieftainRecommendation)}</div>
      <div class="meta-label">Human decision</div><div class="decision">${escapeHtml(metadata.humanDecision)}</div>
    </div>
  </article>

  <section><h2>Executive summary</h2>${renderMarkdown(executiveSummary)}</section>
  <section>
    <h2>Result summary</h2>
    <div class="status-grid">${statusCards(statusSummary)}</div>
    <p><strong>Coverage note:</strong> BLOCKED, DEFERRED and NOT_RUN are visible and never treated as passes.</p>
  </section>
  <section><h2>Run identity and context</h2>${renderMarkdown(inputs.run)}</section>
  <section><h2>Journey / test results</h2>${renderMarkdown(inputs.results)}</section>
  <section><h2>Detailed findings and next increment definitions</h2>${renderMarkdown(inputs.findings)}</section>
  <section><h2>Annotated screenshot evidence</h2>${screenshotHtml}</section>
  <section><h2>Metrics and report-safe supporting evidence</h2>${evidenceHtml(reportSafeEvidence)}</section>
  <section><h2>Unexecuted / blocked / deferred coverage</h2>${renderMarkdown(incompleteCoverageMarkdown(resultRecords))}</section>
  <section><h2>Re-entry and regression plan</h2>${renderMarkdown(reentryPlan)}</section>
  <section><h2>Decision record</h2>${renderMarkdown(decisionRecordMarkdown(metadata))}</section>
  <section><h2>Chronological tester notes</h2>${renderMarkdown(inputs.notes)}</section>
  <section><h2>Evidence appendix</h2>${manifest}</section>
</main>
</body>
</html>`;
}

function validateReportSources(
  inputs: ReportInputs,
  resultRecords: ResultRecord[],
): {
  executiveSummary: string;
  reentryPlan: string;
} {
  const missing: string[] = [];
  const executiveSummary = extractSection(inputs.run, ["Executive summary"]);
  const reentryPlan = extractSection(inputs.findings, [
    "Re-entry and regression plan",
    "Re-entry/regression plan",
  ]);
  if (!executiveSummary) missing.push("run.md -> Executive summary");
  if (!reentryPlan) missing.push("findings.md -> Re-entry and regression plan");
  if (resultRecords.length === 0) {
    missing.push("results.md -> at least one UAT result with an explicit Status cell/field");
  }
  if (missing.length > 0) {
    throw new Error(`UAT report refused: missing required report source(s): ${missing.join("; ")}`);
  }
  return { executiveSummary, reentryPlan };
}

async function renderPdf(htmlPath: string, pdfPath: string): Promise<void> {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:8px;color:#6b7280;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "14mm", right: "13mm", bottom: "18mm", left: "13mm" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to render PDF with Playwright Chromium. Ensure the browser is installed (for example: npx playwright install chromium). Original error: ${message}`,
    );
  } finally {
    await browser?.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const htmlOnly = args.includes("--html-only");
  const positional = args.filter((arg: string) => !arg.startsWith("--"));
  if (positional.length !== 1) usage();
  const runDir = resolve(positional[0] ?? "");
  if (!(await fileExists(runDir))) throw new Error(`UAT run directory does not exist: ${runDir}`);

  const missing: string[] = [];
  for (const file of REQUIRED_LEDGER_FILES) {
    if (!(await fileExists(join(runDir, file)))) missing.push(file);
  }
  if (missing.length > 0) {
    throw new Error(
      `UAT run is missing required ledger file(s): ${missing.join(", ")}. Refusing to produce a final-looking report from an incomplete source ledger.`,
    );
  }

  const inputs: ReportInputs = {
    run: await readFile(join(runDir, "run.md"), "utf8"),
    notes: await readFile(join(runDir, "notes.md"), "utf8"),
    results: await readFile(join(runDir, "results.md"), "utf8"),
    findings: await readFile(join(runDir, "findings.md"), "utf8"),
  };
  const resultRecords = parseResultRecords(inputs.results);
  const { executiveSummary, reentryPlan } = validateReportSources(inputs, resultRecords);
  const reportDir = join(runDir, "report");
  await mkdir(reportDir, { recursive: true });

  const annotatedDir = join(runDir, "screenshots", "annotated");
  const screenshots = (await listFiles(annotatedDir)).filter((path) => imageMime(path));
  const evidenceOnlyFiles = await listFiles(join(runDir, "evidence"));
  const evidenceFiles = [
    ...evidenceOnlyFiles,
    ...(await listFiles(join(runDir, "screenshots", "raw"))),
    ...screenshots,
  ].sort((left, right) => left.localeCompare(right));
  const reportSafeEvidence = await collectReportSafeEvidence(runDir, evidenceOnlyFiles);

  const generatedAt = new Date().toISOString();
  const metadata = metadataFrom(inputs);
  const statusSummary = statusSummaryFromRecords(resultRecords);
  const common = {
    inputs,
    metadata,
    statusSummary,
    resultRecords,
    executiveSummary,
    reentryPlan,
    evidenceFiles,
    reportSafeEvidence,
    runDir,
    generatedAt,
  };

  const markdownPath = join(reportDir, "uat-report.md");
  await writeFile(markdownPath, buildReportMarkdown({ ...common, reportDir, screenshots }), "utf8");
  const htmlPath = join(reportDir, "uat-report.html");
  await writeFile(
    htmlPath,
    buildHtml({ ...common, screenshotHtml: await buildScreenshotHtml(screenshots) }),
    "utf8",
  );
  const pdfPath = join(reportDir, "uat-report.pdf");
  if (!htmlOnly) await renderPdf(htmlPath, pdfPath);

  console.log(
    JSON.stringify(
      {
        runDir,
        sourceLedger: [...REQUIRED_LEDGER_FILES],
        statusSummary,
        annotatedScreenshots: screenshots.length,
        evidenceFiles: evidenceFiles.length,
        embeddedEvidenceFiles: reportSafeEvidence.length,
        outputs: {
          markdown: markdownPath,
          html: htmlPath,
          pdf: htmlOnly ? null : pdfPath,
        },
      },
      null,
      2,
    ),
  );
}

await main();
