import { spawnSync } from "node:child_process";

// Picomatch has no published fix yet. This exception is limited to its one
// reviewed advisory and must be removed once a patched release is available.
const ignoredAdvisories = new Map([
  [
    "GHSA-FC5Q-39XC-VJPF",
    "Picomatch ReDoS; current affected version is transitive dev tooling and no patched release is published.",
  ],
]);

const audit = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });

if (audit.error) {
  console.error(`Could not run npm audit: ${audit.error.message}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error("npm audit did not return a valid JSON report.");
  if (audit.stderr) console.error(audit.stderr.trim());
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities;
if (!vulnerabilities || !report.metadata?.vulnerabilities) {
  console.error("npm audit returned an incomplete report.");
  process.exit(1);
}

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const ignored = new Set();

function advisoryId(advisory) {
  return advisory.url?.match(/GHSA-[\w-]+$/i)?.[0]?.toUpperCase();
}

function effectiveSeverity(packageName, visiting = new Set()) {
  if (visiting.has(packageName)) return "low";

  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) return "low";

  const nextVisiting = new Set(visiting).add(packageName);
  let highest = "low";

  for (const source of vulnerability.via) {
    if (typeof source === "string") {
      const inherited = effectiveSeverity(source, nextVisiting);
      if (severityRank[inherited] > severityRank[highest]) highest = inherited;
      continue;
    }

    const id = advisoryId(source);
    if (id && ignoredAdvisories.has(id)) {
      ignored.add(id);
      continue;
    }

    if (severityRank[source.severity] > severityRank[highest]) {
      highest = source.severity;
    }
  }

  return highest;
}

const remaining = Object.keys(vulnerabilities)
  .map((name) => ({ name, severity: effectiveSeverity(name) }))
  .filter(({ severity }) => severityRank[severity] >= severityRank.high)
  .sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

for (const id of ignored) {
  console.warn(`Temporarily excepted ${id}: ${ignoredAdvisories.get(id)}`);
}

if (remaining.length > 0) {
  console.error("Unexcepted high or critical dependency vulnerabilities remain:");
  for (const { name, severity } of remaining) {
    console.error(`- ${name}: ${severity}`);
  }
  process.exit(1);
}

const counts = report.metadata.vulnerabilities;
console.log(
  `Dependency audit passed: no unexcepted high or critical findings (${counts.moderate} moderate, ${counts.low} low).`,
);
