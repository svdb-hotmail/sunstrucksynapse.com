# UAT report generator

The UAT protocol in `docs/uat-script.md` uses a deterministic repository-local report generator.

## Command

```bash
npm run uat:report -- test-results/uat/<RUN_ID>
```

The command reads the preserved run ledger and writes:

```text
test-results/uat/<RUN_ID>/report/
  uat-report.md
  uat-report.html
  uat-report.pdf
```

Use `--html-only` when validating report assembly without launching Chromium:

```bash
npm run uat:report -- test-results/uat/<RUN_ID> --html-only
```

## Required source ledger

The generator refuses to create a final-looking report unless all four source files exist:

```text
run.md
notes.md
results.md
findings.md
```

It also discovers, without requiring them to exist:

```text
evidence/**
screenshots/raw/**
screenshots/annotated/**
```

Raw screenshots are listed in the evidence manifest but are not embedded in the PDF. Supported annotated `.png`, `.jpg`, `.jpeg`, and `.webp` screenshots are embedded into the HTML/PDF as data URIs so the rendered report does not depend on temporary file URLs or a web server.

## Result summary

Status counts are derived from unique `UAT-*` IDs found in `results.md`. Each recorded test must use exactly one of:

```text
PASS
FAIL
BLOCKED
DEFERRED
NOT_RUN
```

`BLOCKED`, `DEFERRED`, and `NOT_RUN` remain visibly separate from passes.

## PDF rendering

PDF rendering uses the repository's existing Playwright dependency and Chromium. If Chromium is not installed in a local development environment, install the Playwright browser before running the PDF command:

```bash
npx playwright install chromium
```

The normal generator command is expected to produce the PDF. `--html-only` is a test/debug option, not a substitute for the mandatory PDF at an actual UAT checkpoint.

## Evidence responsibility

The generator assembles evidence; it does not invent or reinterpret it. Before report generation, the testing DevAI/human pair remains responsible for:

- preserving the original screenshots under `screenshots/raw/`;
- creating separate redacted/annotated derivatives under `screenshots/annotated/`;
- tying visual callouts to finding IDs;
- recording the observed and expected behavior;
- classifying the next increment as `FIX`, `REFINE`, `RETHINK`, `INSTRUMENT`, or `CONFIGURE`;
- recording the definition of resolved or the decision needed before a rethink can be implemented;
- defining explicit acceptance criteria for retest.

The report generator deliberately keeps the ledger text in the report so that a polished PDF cannot replace or erase the underlying tester observations.
