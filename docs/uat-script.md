# User acceptance test and evidence protocol

Use this protocol against a production-like deployment with real, rights-cleared catalogue content. It is designed for three execution modes:

1. **Human-led UAT** — a human tester executes the journey and records evidence.
2. **DevAI-assisted UAT** — the DevAI guides the human one test at a time, preserves notes/screenshots, evaluates observable results, and compiles the report.
3. **DevAI-executed UAT** — the DevAI executes automatable checks itself and asks a human only where credentials, real devices, subjective judgment, policy decisions, or destructive/privileged actions require human participation.

The protocol is evidence-first. A test is not `PASS` because the code looks correct, because an automated test passed, or because no error was noticed. It is `PASS` only when the expected behavior was actually observed and the evidence is recorded.

Do not record signed media URLs, invitation tokens, passwords, contact information, private evidence keys, authorization headers, cookies, or other secrets.

**Release authority:** the DevAI may recommend **GO**, **ITERATE**, or **STOP**, but only the human maintainer records the final release decision.

---

## 0. UAT operating contract

### 0.1 Roles and authority

**Human tester / maintainer**

- Performs steps that require real-user judgment, privileged credentials, physical devices, assistive technology, or destructive infrastructure actions.
- Can correct a DevAI interpretation, but the original observation must remain in the run notes.
- Owns product trade-off decisions and the final `GO / ITERATE / STOP` decision.

**DevAI**

- Reads the approved candidate, acceptance criteria, product documentation, and this protocol before testing.
- Runs automatable checks and browser journeys where the environment permits.
- In co-test mode, gives the human exactly one actionable UAT step at a time unless the human explicitly asks for a batch.
- Explains what to do, what should happen, and what evidence is needed before the human performs the step.
- Preserves every human note and screenshot; it may normalize wording for the report but must not erase the source note.
- Never invents an observation, screenshot, metric, browser result, or successful test.
- Never changes a `FAIL`, `BLOCKED`, `DEFERRED`, or `NOT_RUN` result into `PASS` merely because a likely implementation fix is identified.
- May inspect code/logs after a failure to help classify the finding, but code inspection is supporting evidence, not UAT evidence.
- Produces an annotated evidence set and a human-readable PDF report at every explicit UAT checkpoint, including when the human stops the run before all gates are complete.

### 0.2 Execution labels

Each test is marked with one of these execution labels:

- **A — Automatable:** DevAI may execute autonomously when it has the required environment and safe access.
- **C — Co-test:** DevAI may execute or guide, but human observation/judgment is useful or required for acceptance.
- **H — Human:** human action/approval is required. DevAI may prepare instructions, capture evidence, and record the result.

### 0.3 Result vocabulary

Every test must end in exactly one status:

- **PASS** — expected behavior was observed and evidence exists.
- **FAIL** — observed behavior contradicts the expected result or release criterion.
- **BLOCKED** — the test could not be meaningfully executed because a prerequisite, environment, permission, dependency, or earlier failure prevents it.
- **DEFERRED** — the human maintainer deliberately postpones the test and records why.
- **NOT_RUN** — no attempt was made yet.

`BLOCKED`, `DEFERRED`, and `NOT_RUN` are never counted as passes.

### 0.4 Run workspace and evidence retention

Create one run directory per candidate under the already ignored `test-results/` tree:

```text
test-results/uat/<RUN_ID>/
  run.md
  notes.md
  results.md
  findings.md
  evidence/
    logs/
    metrics/
  screenshots/
    raw/
    annotated/
  report/
    uat-report.md
    uat-report.html
    uat-report.pdf
```

Recommended `RUN_ID`:

```text
YYYY-MM-DD_<short-sha>_<environment>
```

The run directory is the source package for that UAT execution. Do not overwrite a previous run when the candidate or deployment changes.

`run.md` must record:

```text
Run ID
Start date/time and timezone
Candidate commit SHA
Deployment URL/environment
Deployment/build identifier if available
Human tester(s)
DevAI/session identifier if applicable
Browser/device/OS matrix
Relevant feature flags/configuration state without secret values
Known pre-existing issues
Stop/resume timestamps
Final decision and signer when available
```

`notes.md` is chronological and append-oriented. Preserve the tester's original meaning, including uncertainty, partial observations, and comments such as “nothing happened”, “it scrolled to the top”, or “the cover art is missing”. A later diagnosis belongs underneath the original note; it must not replace it.

### 0.5 One-step co-test loop

When testing with a human, the DevAI should use this loop:

1. Identify the next UAT test ID and prerequisite.
2. Tell the human only the next action to perform.
3. State the expected result in plain language.
4. State what to observe and whether a screenshot is needed.
5. After the human responds or supplies a screenshot, append the note/evidence before interpretation.
6. Record `PASS / FAIL / BLOCKED / DEFERRED` with a short rationale.
7. If the result is not `PASS`, create or update a finding and produce an annotated screenshot when visual evidence exists.
8. Only then move to the next test.

If the human says **stop**, stop the execution sequence and immediately compile a checkpoint report from everything recorded so far. Untested steps remain `NOT_RUN`; do not silently omit them.

---

## 1. Evidence and screenshot standard

### 1.1 Raw evidence is immutable

For every screenshot supplied by a human or captured by DevAI/browser automation:

- Save the original unchanged in `screenshots/raw/`.
- Never draw, crop, blur, resize, or overwrite the only copy of the raw screenshot.
- Use a separate derivative in `screenshots/annotated/` for reporting.
- A crop may be added as secondary evidence, but the full-context raw screenshot must remain available.
- If the screenshot contains sensitive information, keep the raw file private and create a redacted derivative for the report. Redaction must be irreversible on the derivative.

Recommended naming:

```text
<UAT-ID>_<sequence>_<short-description>_raw.png
<UAT-ID>_<sequence>_<short-description>_annotated.png
```

### 1.2 Annotated screenshot format

Every screenshot used to explain a finding should become an annotated evidence plate. The plate must preserve the screenshot itself and add overlays without hiding the relevant UI.

Use:

- numbered boxes/arrows/callouts on the affected UI;
- the finding ID next to each callout;
- text labels in addition to color so the annotation remains understandable without color perception;
- a side or bottom annotation panel containing the issue definition.

The annotation panel must contain:

```text
Finding ID + severity
Finding type
Observed
Expected
Why it matters
Next increment: FIX / REFINE / RETHINK / INSTRUMENT / CONFIGURE
Definition of resolved or rethink decision needed
Retest acceptance criterion
```

For a straightforward defect, **Definition of resolved** describes the required observable outcome, not a speculative code patch.

For a product/design ambiguity, use **Rethink decision needed** instead of pretending there is an obvious implementation fix. State the product question, the problematic current behavior, the desired user outcome, and what evidence would make the next iteration acceptable.

### 1.3 Finding types

Use one primary type per finding:

- **DEFECT** — behavior clearly violates an agreed expectation.
- **PRODUCT_GAP** — a necessary capability or state is absent.
- **UX_FRICTION** — the journey technically works but is confusing, misleading, inefficient, or error-prone.
- **DESIGN_RETHINK** — the current interaction/model appears conceptually wrong or requires a product decision before implementation.
- **TESTABILITY_GAP** — the behavior cannot be proven reliably because observability, diagnostics, data, or tooling is missing.
- **ENVIRONMENT_CONFIG** — deployment/configuration prevents the intended behavior.

### 1.4 Finding record

Every non-pass observation that matters to the product must have a record in `findings.md`:

```text
Finding ID
Source UAT test ID(s)
Status: OPEN / ACCEPTED_RISK / FIXED_PENDING_RETEST / CLOSED
Severity: Critical / High / Medium / Low
Type
Observed behavior
Expected behavior
User/product impact
Evidence references
Reproduction steps
Environment/candidate
Known technical diagnosis, if verified
Next increment classification: FIX / REFINE / RETHINK / INSTRUMENT / CONFIGURE
Definition of resolved OR rethink decision needed
Acceptance criteria for retest
Dependencies / related findings
Issue/PR link when one exists
Human decision/owner when required
```

Do not turn a finding into an implementation prescription unless the evidence actually supports that conclusion. The report should make the next product increment implementable while preserving room for engineering judgment.

---

## 2. Setup and preflight

| ID | Mode | Step | Expected result | Result / evidence |
| --- | --- | --- | --- | --- |
| UAT-SET-01 | A/C | Deploy the approved build with production-like Neon, R2, Cloudflare Access, transactional email, and analytics bindings. | Candidate/build is identifiable and required bindings are present. | |
| UAT-SET-02 | A/C | Prepare at least 10 reviewed artists, 30 reviewed tracks, and five published collections. | Required catalogue volume exists. | |
| UAT-SET-03 | A | Run `npm run catalogue:audit`. | Zero missing metadata, media, artwork, and review records. | |
| UAT-SET-04 | H/C | Prepare one invited submitter, one Cloudflare Access curator, and 20-50 invited listeners. | Required UAT identities/cohort are available without exposing credentials in evidence. | |
| UAT-SET-05 | H/C | Prepare desktop Chrome or Edge, Firefox, and Safari/WebKit; Android Chromium; and iOS Safari/WebKit. | Browser/device matrix is recorded. | |
| UAT-SET-06 | H/C | Prepare native assistive-technology environments for VoiceOver, TalkBack, and NVDA. | AT environments/testers are available or explicitly recorded as blocked/deferred. | |

A missing prerequisite does not disappear from the report. Record the affected setup test as `FAIL`, `BLOCKED`, or `DEFERRED`, then mark dependent tests accordingly.

---

## 3. Public catalogue and discovery

| ID | Mode | Step | Expected result | Result / evidence |
| --- | --- | --- | --- | --- |
| UAT-CAT-01 | A/C | Open the home page. | Published catalogue loads; no unpublished or archived work appears. | |
| UAT-CAT-02 | A/C | Open artist, release, and track pages. | Stable URL, correct title/artwork/credits, and a playable public asset appear. | |
| UAT-CAT-03 | A/C | Search for a known artist, release, and track. | Each query returns the correct result. | |
| UAT-CAT-04 | A/C | Apply genre, mood, process, and media filters; reload/share URL. | Results and active filters remain represented in the URL. | |
| UAT-CAT-05 | A/C | Open each editorial collection. | Ordered tracks load and each track is playable or intentionally unavailable. | |
| UAT-CAT-06 | A/C | Open the reviewed disclosure for one accepted track. | Public rights/process/provenance summary appears; private notes, hidden roles/tools, evidence, object keys, and curator data do not appear. | |

**Blocker:** unpublished/private content is exposed, published content is missing unexpectedly, or public disclosure exposes non-public data.

For visually wrong catalogue states—missing artwork, fallback artwork, wrong credits, layout breakage, misleading controls—capture a full screenshot and create an annotated evidence plate even when the underlying data diagnosis is already known.

---

## 4. Playback, queue, and recovery

| ID | Mode | Step | Expected result | Result / evidence |
| --- | --- | --- | --- | --- |
| UAT-PB-01 | A/C | Start one audio track and one video track. | Native controls enable and `playback_started` is recorded. | |
| UAT-PB-02 | A/C | Queue two tracks from a collection, then play the first. | Queue order is retained; collection attribution remains on lifecycle analytics for queued collection tracks. | |
| UAT-PB-03 | A/C | Pause, seek, resume, skip, replay, and complete playback. | Controls work; corresponding lifecycle events are captured once with sensible progress. | |
| UAT-PB-04 | A/C | Start an unavailable track. | Clear unavailable state; no false successful playback event. | |
| UAT-PB-05 | A/C | Interrupt network or use an expired signed URL, then Retry. | Failure is explained; Retry obtains a fresh playable URL without losing selected item/queue. | |
| UAT-PB-06 | A | Run 100 explicit play attempts across representative audio/video assets. | At least 98 produce `playback_started`; record successes, failures, median, and p95 request-to-start time. | |
| UAT-PB-07 | A | Inspect median start latency. | Median is below 1.5 seconds on the agreed broadband profile. | |
| UAT-PB-08 | A | Request `Range: bytes=0-1023` from a fresh signed media URL without persisting the URL. | `206`, valid `Content-Range`, and exactly 1,024 bytes are returned. | |

**Blocker:** start rate is below 98%, median start is 1.5 seconds or more, playback recovery fails, or listener activity leaks a signed URL.

Metrics belong in `evidence/metrics/` and must be summarized in the PDF; do not paste signed media URLs or private request headers into the report.

---

## 5. Submission and curator review

| ID | Mode | Step | Expected result | Result / evidence |
| --- | --- | --- | --- | --- |
| UAT-SUB-01 | H/C | Open an invitation link and save a complete draft. | Draft persists and is accessible only via its invitation link. | |
| UAT-SUB-02 | H/C | Submit with all required declarations. | Submission changes to `received`; submitter receives the configured acknowledgement. | |
| UAT-SUB-03 | A/C | Attempt direct acceptance before listening. | Rejected with a transition conflict; no acceptance is recorded. | |
| UAT-SUB-04 | H/C | Curator moves a valid submission through eligibility review to listening, then accepts it. | Permitted transitions work; accepted declaration revisions and curator activity are immutable/auditable. | |
| UAT-SUB-05 | H/C | Upload private evidence at 20 MiB with an allowed MIME type. | Upload succeeds and remains private. | |
| UAT-SUB-06 | A/C | Upload SVG, archive, unsupported MIME, or a file over 20 MiB. | Upload is rejected before storage/hash completion with an understandable error. | |
| UAT-SUB-07 | A/C | Open public disclosure after acceptance. | Public view excludes private evidence, private notes, and non-public role/tool declarations. | |

**Blocker:** invitation or evidence access is public, an invalid lifecycle transition succeeds, or private data appears publicly.

Never embed invitation tokens or private-evidence URLs in screenshots used in the PDF. Redact them on the report derivative while retaining the private raw evidence securely.

---

## 6. Curator access, policy, and recovery

| ID | Mode | Step | Expected result | Result / evidence |
| --- | --- | --- | --- | --- |
| UAT-CUR-01 | A/C | Visit curator routes without Cloudflare Access. | Access is denied. | |
| UAT-CUR-02 | H/C | Visit curator routes with authorized Access identity. | Curator functions are available; actions record actor and timestamp. | |
| UAT-CUR-03 | A/C | Open privacy, terms, and accessibility/policy pages. | Pages load and policy links are usable without authentication. | |
| UAT-CUR-04 | H | Create a protected Neon restore point/export and restore to an isolated environment. | Migration, catalogue audit, public playback, private-evidence isolation, curator Access, and publication history all validate. | |
| UAT-CUR-05 | H/C | Record recovery exercise. | Restore point, operator, elapsed time, row counts, checksums, outcome, and cleanup confirmation are captured. | |

**Blocker:** unauthorized curator access, unavailable policy pages, or a failed isolated restore drill.

The DevAI must not initiate destructive production recovery actions without explicit human authorization. It may prepare commands/checks, record outputs, and validate the isolated result.

---

## 7. Accessibility and browser review

| ID | Mode | Step | Expected result | Result / evidence |
| --- | --- | --- | --- | --- |
| UAT-A11Y-01 | C | Desktop Chrome/Edge, Firefox, and Safari/WebKit: navigate by keyboard. | Visible focus, logical heading/navigation order, operable search/filter/player/queue controls, and no horizontal overflow. | |
| UAT-A11Y-02 | H/C | Android and iOS: browse, queue, play, and navigate. | Controls remain usable; page does not overflow horizontally. | |
| UAT-A11Y-03 | A/C | Enable reduced-motion preference. | Scrolling/focus movement respects reduced motion. | |
| UAT-A11Y-04 | H/C | VoiceOver, TalkBack, and NVDA: complete discovery and playback journey. | Labels, status/error announcements, native media controls, and focus changes are understandable. | |

**Blocker:** any critical/high defect prevents navigation, selection, playback control, queue control, recovery, form completion, or policy access.

Automated accessibility scans may support these tests but do not replace real keyboard/AT interaction evidence.

---

## 8. Invited listener cohort and analytics

| ID | Mode | Step | Expected result | Result / evidence |
| --- | --- | --- | --- | --- |
| UAT-COHORT-01 | H | Invite 20-50 listeners with the private-evaluation scope, privacy notice, supported browsers, troubleshooting link, feedback route, and separate technical-incident route. | Cohort and communication scope are recorded. | |
| UAT-COHORT-02 | H | Run the agreed cohort period. | Cohort period completes with technical incidents recorded. | |
| UAT-COHORT-03 | A/H | Export only aggregate dashboard data. | No low-volume participant-level data is published. | |
| UAT-COHORT-04 | A/C | Record invited count, first sessions, second sessions, playback sample size, starts, failures, median/p95 start time, failure classes, curator preparation time, accessibility defects, feedback themes, and incidents. | Required evaluation dataset is complete. | |
| UAT-COHORT-05 | A | Calculate second-session return rate. | At least 25% of invited listeners start a second session. | |

**Blocker:** return rate below 25%, missing aggregate evidence, or unresolved critical/high issues.

---

## 9. From observation to next product increment

A UAT report is not complete when it merely says what failed. Every material finding must make the next iteration decision-ready.

For each finding, the DevAI proposes exactly one **next increment classification**:

### FIX

Use when expected behavior is clear and the implementation is wrong.

Required definition:

```text
Target user-visible/system outcome
Acceptance criteria
Regression surface to protect
Retest UAT ID(s)
```

### REFINE

Use when the flow works but causes avoidable friction or ambiguity.

Required definition:

```text
Observed friction
Desired experience improvement
Constraints that must remain true
Acceptance hypothesis / measurable outcome
Retest UAT ID(s)
```

### RETHINK

Use when UAT reveals that the current product interaction, information model, workflow, or assumption may be wrong and implementing a local patch would risk preserving the wrong design.

Required definition:

```text
Decision/question that must be resolved
Evidence that triggered the rethink
Affected users/journey
Outcome the revised design must achieve
Constraints / invariants
What must be decided before implementation
How the next UAT will prove the decision
```

### INSTRUMENT

Use when the product may work but the team cannot prove it reliably.

Required definition:

```text
Missing observable signal
Why current evidence is insufficient
Minimum telemetry/diagnostic capability required
Acceptance criterion for testability
```

### CONFIGURE

Use when environment/deployment configuration is the primary blocker.

Required definition:

```text
Missing/incorrect configuration capability
Environment(s) affected
Verification method without exposing secrets
Retest UAT ID(s)
```

The DevAI may suggest a likely technical area or implementation boundary, but the **definition of resolved** must stay outcome-based unless a specific implementation is already an accepted architectural constraint.

---

## 10. PDF report contract

A human-readable PDF is a mandatory artifact for every completed or explicitly stopped UAT run.

The DevAI should build the report from the preserved run ledger, not from memory. The Markdown/HTML source remains alongside the PDF so the report is reproducible. Prefer Playwright/Chromium already available in the repository for HTML-to-PDF rendering when practical.

### 10.1 Required report structure

1. **Cover / run identity**
   - Product
   - environment/deployment
   - candidate SHA/build
   - run ID
   - dates/timezone
   - human tester(s)
   - DevAI involvement
   - browser/device scope

2. **Executive summary**
   - what product journey was actually proven
   - what remains unproven
   - most important failures/gaps
   - recommended `GO / ITERATE / STOP`
   - human decision if recorded

3. **Result summary**
   - counts of `PASS / FAIL / BLOCKED / DEFERRED / NOT_RUN`
   - release-gate matrix
   - explicit distinction between failed coverage and unexecuted coverage

4. **Journey/test results**
   - every UAT test ID
   - expected result
   - observed result
   - status
   - concise tester note
   - evidence reference

5. **Detailed findings**
   - one finding card per material issue
   - severity/type/impact
   - observed vs expected
   - reproduction
   - annotated screenshot(s)
   - next increment classification
   - definition of resolved or rethink decision needed
   - retest acceptance criteria
   - issue/PR link when available

6. **Annotated screenshot evidence**
   - readable size; do not reduce screenshots to illegible thumbnails
   - callouts must correspond to finding IDs
   - annotation panel must include the next-iteration definition
   - sensitive values redacted on the report derivative

7. **Unexecuted / blocked / deferred coverage**
   - why it was not completed
   - dependency or prerequisite
   - re-entry condition

8. **Re-entry and regression plan**
   - exact findings that must change before resuming
   - UAT IDs to rerun
   - automated regression coverage to add where appropriate

9. **Decision record**
   - DevAI recommendation
   - human maintainer decision
   - date/signer
   - accepted residual risks

10. **Evidence appendix**
    - evidence manifest / filenames
    - metric summaries
    - sanitized logs when useful
    - do not embed secrets or private URLs

### 10.2 Report quality bar

The PDF must be understandable by a product/engineering stakeholder who did not participate in the test. It must answer:

```text
What did we test?
Against which candidate/environment?
What actually worked?
What failed or was not tested?
What did the human observe?
Where is the visual evidence?
Why does each issue matter?
Is this a fix, refinement, rethink, instrumentation, or configuration problem?
What outcome is required in the next increment?
How will we know the issue is resolved?
Can we release now?
```

The report must not bury failures in raw logs, omit screenshots because a textual diagnosis exists, or convert uncertainty into confident prose.

---

## 11. Final decision record

| Gate | Pass / fail / incomplete | Evidence | Findings / follow-up |
| --- | --- | --- | --- |
| Catalogue readiness | | | |
| Public privacy boundary | | | |
| Playback reliability and latency | | | |
| Submission and curator workflow | | | |
| Access and private evidence boundary | | | |
| Restore drill | | | |
| Accessibility and browser review | | | |
| Listener cohort and return rate | | | |

**DevAI recommendation:** GO / ITERATE / STOP

**Human maintainer decision:** GO / ITERATE / STOP

**Decision date and signer:**

**Known residual risk and follow-up issues:**

### Decision rules

- **GO** only when all required release gates have measured evidence, no unresolved blocker contradicts release criteria, and the human maintainer accepts documented residual risk.
- **ITERATE** when a meaningful product slice is proven but defects, product gaps, UX/design issues, or incomplete evidence require another increment before release.
- **STOP** when a critical safety/privacy/access failure, a release-blocking defect, or insufficient foundational evidence makes continued release evaluation unsupported.

A partial run may still produce a strong **ITERATE** or **STOP** checkpoint report. Never force the run to completion merely to obtain a final-looking PDF.

---

## 12. DevAI completion checklist

Before declaring the UAT checkpoint complete, verify:

- [ ] Candidate SHA/environment/build identity is recorded.
- [ ] Every attempted UAT step has a status and evidence reference.
- [ ] Every unattempted required step is explicitly `NOT_RUN` or `DEFERRED`.
- [ ] Human notes are preserved.
- [ ] Raw screenshots are preserved unchanged.
- [ ] Material visual findings have annotated screenshot derivatives.
- [ ] Annotated screenshots identify the issue and include the next-iteration resolution/rethink definition.
- [ ] Every material non-pass observation maps to a finding.
- [ ] Every finding has impact, classification, and retest acceptance criteria.
- [ ] Metrics/log evidence is summarized without exposing secrets.
- [ ] The report distinguishes implementation defects from product/design rethink decisions.
- [ ] The PDF contains results, findings, screenshots, unresolved coverage, and re-entry criteria.
- [ ] DevAI recommendation and human release authority are clearly separated.
- [ ] `uat-report.md`, `uat-report.html`, and `uat-report.pdf` are saved under the run directory.

The DevAI must not state **UAT complete**, **release ready**, or **GO** while any required item above is knowingly false.