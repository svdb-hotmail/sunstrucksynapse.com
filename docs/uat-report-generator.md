# Sunstruck Synapse UAT report generator

The governed UAT protocol in `docs/uat-script.md` uses `scripts/generate-uat-report.ts` to assemble a preserved run ledger into reproducible Markdown, self-contained HTML, and PDF.

## Command

```bash
npm run uat:report -- test-results/uat/<RUN_ID>
```

Outputs:

```text
test-results/uat/<RUN_ID>/report/
  uat-report.md
  uat-report.html
  uat-report.pdf
```

For assembly/unit validation without launching Chromium:

```bash
npm run uat:report -- test-results/uat/<RUN_ID> --html-only
```

`--html-only` is not a substitute for the mandatory PDF at an actual completed or explicitly stopped UAT checkpoint unless the PDF step is itself recorded as blocked.

## Source ledger and fail-closed report contract

The generator requires all four ledger files:

```text
run.md
notes.md
results.md
findings.md
```

It additionally requires source material for mandatory report sections:

- `run.md` contains `## Executive summary`;
- `findings.md` contains `## Re-entry and regression plan`;
- `results.md` contains at least one UAT result with an explicit `Status`/`Result` cell or `Status: ...` field.

The generator refuses to produce a final-looking report when those requirements are absent.

Metadata supports ordinary and bold Markdown forms including:

```text
Run ID: value
**Run ID:** value
**Run ID**: value
```

## Result counting

Each result uses exactly one of:

```text
PASS
FAIL
BLOCKED
DEFERRED
NOT_RUN
```

For table-form results, the generator reads the designated `Status` or `Result` column. It does not search arbitrary expected/observed/evidence text for status words. Therefore a row such as:

```markdown
| UAT-CAT-02 | FAIL | Expected PASS artwork state was absent |
```

is correctly counted as `FAIL`.

The latest explicit status encountered for a unique `UAT-*` ID is used.

## Governed decision vocabulary

Current reports distinguish:

- **Chieftain recommendation**;
- **Shaman / Warden acceptance evidence** where applicable;
- **human maintainer decision**.

The generator accepts `DevAI recommendation` only as a backward-compatible fallback for older run ledgers. New runs should use the governed role names from `AGENTS.md` and `docs/uat-script.md`.

## Report sections

When source validation succeeds, the generated Markdown/HTML/PDF contains distinct sections for:

1. cover/run identity;
2. executive summary;
3. result summary;
4. run identity/context;
5. journey/test results;
6. detailed findings;
7. annotated screenshot evidence;
8. metrics and report-safe supporting evidence;
9. unexecuted/blocked/deferred coverage;
10. re-entry/regression plan;
11. decision record;
12. chronological tester notes;
13. evidence appendix.

## Evidence and secret safety

The generator discovers:

```text
evidence/**
screenshots/raw/**
screenshots/annotated/**
```

The evidence directory is not a secret store. The UAT protocol prohibits retaining passwords, credentials, cookies, authorization headers, invitation tokens, private-evidence bearer URLs/tokens, signed media URLs, or other reusable secrets. Secret-bearing captures must be discarded and recaptured; they must never be preserved merely because they are called "raw evidence".

For report-safe supporting evidence, the generator embeds sanitized `.txt`, `.md`, `.json`, `.csv`, and `.log` files from `evidence/**` when each file is at most 128 KiB. This makes metric/log evidence inspectable in the self-contained HTML/PDF rather than reducing it to a path-only manifest.

Other/binary/larger evidence remains manifest-only.

Supported annotated `.png`, `.jpg`, `.jpeg`, and `.webp` screenshots are embedded as data URIs. Admissible raw screenshots are listed in the manifest but never automatically embedded. Screenshot filenames are escaped before Markdown generation so Markdown-sensitive characters cannot corrupt the report.

## Evidence responsibility

Before report generation, the governed UAT participants remain responsible for:

- screening captures/logs for prohibited secrets before retention;
- preserving admissible source observations before diagnosis;
- preserving admissible raw screenshots unchanged;
- creating separate report-safe annotated/redacted derivatives;
- tying visual callouts to finding IDs;
- recording observed and expected behavior;
- classifying each next increment as `FIX`, `REFINE`, `RETHINK`, `INSTRUMENT`, or `CONFIGURE`;
- defining retest acceptance criteria and a re-entry/regression plan;
- recording Chieftain recommendation, independent Shaman/Warden evidence where required, and human decision separately.

## Verification

`tests/unit/generate-uat-report.test.ts` exercises the real CLI in `--html-only` mode. It guards:

- common bold metadata parsing;
- status-cell correctness even when other cells contain status words;
- required report sections;
- report-safe metric evidence embedding;
- annotated-only image embedding and raw manifest retention;
- Markdown-safe screenshot filenames;
- failure when a required ledger file or mandatory report-source section is missing.

PDF rendering uses the repository's existing Playwright Chromium dependency through a platform-correct `file:` URL.
