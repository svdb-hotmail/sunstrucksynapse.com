# Sunstruck Synapse user acceptance test and evidence protocol

Use this protocol against a production-like Sunstruck Synapse Radio deployment with real, rights-cleared catalogue content.

Before a run, read the current candidate/PR acceptance criteria together with:

1. `docs/product-scope.md` for the MVP product boundary;
2. `docs/private-beta-evaluation.md` for the private-beta release thresholds;
3. `docs/database.md`, `docs/media-protection.md`, and the operations/recovery documentation for infrastructure boundaries;
4. this protocol for the evidence and co-testing method.

The repository's automated tests are supporting evidence, not user acceptance. A test is `PASS` only when its expected behavior is actually observed against the identified candidate and evidence is recorded.

The protocol supports three execution modes:

1. **Human-led UAT** — a human executes the journey and records evidence.
2. **DevAI-assisted UAT** — the DevAI guides the human one test at a time, preserves notes/screenshots, evaluates observable results, and compiles the report.
3. **DevAI-executed UAT** — the DevAI executes safe automatable checks and asks a human where credentials, real devices, editorial judgment, policy decisions, or destructive/privileged actions require human participation.

**Release authority:** the DevAI may recommend **GO**, **ITERATE**, or **STOP**, but only the human maintainer records the final release decision.

## 0. Sunstruck beta scope that this UAT must respect

Sunstruck Synapse Radio is a human-curated listening destination for intentional AI-assisted music. The private-beta UAT must prove the listener, submission, curation, publication, privacy, analytics, recovery, and accessibility experience that is actually inside the MVP.

The following release thresholds come from `docs/private-beta-evaluation.md` and are not DevAI inventions:

- prepared catalogue: **10–20 artists, 30–50 reviewed tracks, five published collections**;
- invited cohort: **20–50 listeners**;
- returning-listener gate: **at least 25% of invitees start a second session**;
- curator release-preparation gate: **a prepared release can be published in under 15 minutes**;
- playback-start reliability: **above 98%**;
- median playback start: **below 1.5 seconds** on the agreed production-like broadband profile;
- isolated provider/database restore drill: verified;
- accessibility: no unresolved Critical/High defect in the required journey.

### Public video is not a beta release gate

`docs/product-scope.md` explicitly excludes a **public video catalogue** from the MVP. Therefore:

- public playback reliability/latency UAT is measured against representative **audio** tracks;
- a video asset or video-capable implementation may be tested as additional evidence when relevant, but inability to provide a public video catalogue does not fail the Sunstruck MVP;
- no DevAI may reintroduce “audio + video public playback” as a required beta gate unless the product scope is deliberately changed.

## 1. UAT operating contract

### 1.1 Roles and authority

**Human tester / maintainer**

- Performs steps requiring real-user/editorial judgment, privileged credentials, physical devices, assistive technology, or destructive infrastructure actions.
- Can correct a DevAI interpretation, but the original observation remains in the run notes.
- Owns product trade-offs, accepted risks, and the final `GO / ITERATE / STOP` decision.

**DevAI**

- Reads the candidate, acceptance criteria, product scope, beta evaluation, and this protocol before testing.
- Runs automatable checks and browser journeys where the environment permits.
- In co-test mode gives exactly one actionable step at a time unless the human explicitly asks for a batch.
- States what to do, what should happen, and what evidence is needed before the action.
- Appends the human observation/evidence before interpreting or diagnosing it.
- Preserves every human note and screenshot; normalized report wording never erases the source observation.
- Never invents an observation, screenshot, metric, browser result, email receipt, analytics event, restore result, or successful playback.
- Never changes a `FAIL`, `BLOCKED`, `DEFERRED`, or `NOT_RUN` into `PASS` merely because a likely implementation fix is found.
- May inspect code/logs after a failure to classify it, but code inspection is supporting diagnosis, not UAT evidence.
- Produces annotated evidence and a human-readable PDF at every explicit UAT checkpoint, including an intentionally stopped partial run.

### 1.2 Execution labels

- **A — Automatable:** DevAI may execute autonomously when it has the required safe access/environment.
- **C — Co-test:** DevAI may execute or guide, but human observation/judgment is useful or required.
- **H — Human:** human action/approval is required.

### 1.3 Result vocabulary

Every active test ends in exactly one status:

- **PASS** — expected behavior observed and evidence exists.
- **FAIL** — observed behavior contradicts the requirement.
- **BLOCKED** — a prerequisite/environment/permission/dependency prevents meaningful execution.
- **DEFERRED** — the human deliberately postpones the test and records why.
- **NOT_RUN** — no attempt has been made yet.

`BLOCKED`, `DEFERRED`, and `NOT_RUN` never count as passes.

### 1.4 One-step co-test loop

When co-testing with a human:

1. Identify the next UAT test ID and prerequisite.
2. Give the human one action.
3. State the expected result in plain language.
4. State what to observe and whether a screenshot is needed.
5. Append the response/evidence before interpretation.
6. Record `PASS / FAIL / BLOCKED / DEFERRED` with a short rationale.
7. For a material non-pass, create/update a finding and annotate the screenshot when visual evidence exists.
8. Only then continue.

If the human says **stop**, stop immediately and compile the checkpoint report. Remaining required tests remain `NOT_RUN`.

## 2. Run workspace and evidence retention

Use the already ignored `test-results/` tree:

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

`run.md` records:

```text
Run ID
Product: Sunstruck Synapse Radio
Start date/time and timezone
Candidate commit SHA
Candidate PR if applicable
Deployment URL/environment
Deployment/build identifier
Human tester(s)
DevAI/session identifier if applicable
Browser/device/OS matrix
Relevant configuration state without secret values
Catalogue/cohort preparation state
Known pre-existing issues
Stop/resume timestamps
DevAI recommendation
Human maintainer decision and signer when available
```

`notes.md` is chronological and append-oriented. Preserve the tester's own meaning, including observations such as “nothing happened”, “it scrolled to the top”, “the cover art is missing”, or “I did not receive an email”. A later diagnosis belongs underneath the original note and never replaces it.

Do not record signed media URLs, invitation tokens, passwords, contact information, private evidence keys, authorization headers, cookies, database credentials, or other secrets.

## 3. Screenshot and finding standard

### 3.1 Raw evidence is immutable

For every screenshot supplied by a human or captured by automation:

- Save the original unchanged in `screenshots/raw/`.
- Never draw, crop, blur, resize, or overwrite the only raw copy.
- Use a separate derivative in `screenshots/annotated/` for reporting.
- A crop may be secondary evidence, but keep the full-context raw screenshot.
- If sensitive information is visible, keep raw evidence private and create an irreversibly redacted report derivative.

Recommended naming:

```text
<UAT-ID>_<sequence>_<description>_raw.png
<UAT-ID>_<sequence>_<description>_annotated.png
```

### 3.2 Annotated evidence plate

Every visual finding used in the report should include numbered boxes/arrows/callouts without hiding the relevant UI. The annotation panel must contain:

```text
Finding ID + severity
Finding type
Observed
Expected
Why it matters
Next increment: FIX / REFINE / RETHINK / INSTRUMENT / CONFIGURE
Definition of resolved OR rethink decision needed
Retest acceptance criterion
```

For a defect, **Definition of resolved** describes the required observable outcome, not a speculative patch.

For product/design ambiguity, use **Rethink decision needed** and state the product question, problematic behavior, desired user outcome, constraints, and evidence needed to accept the next design.

### 3.3 Finding types

- **DEFECT** — behavior violates an agreed expectation.
- **PRODUCT_GAP** — a necessary capability/state is absent.
- **UX_FRICTION** — the journey works but is confusing, misleading, inefficient, or error-prone.
- **DESIGN_RETHINK** — the interaction/model requires a product decision before implementation.
- **TESTABILITY_GAP** — behavior cannot be proven reliably because observability/data/tooling is missing.
- **ENVIRONMENT_CONFIG** — deployment/configuration prevents intended behavior.

### 3.4 Finding record

Every material non-pass gets a record in `findings.md`:

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
Verified technical diagnosis, if known
Next increment classification
Definition of resolved OR rethink decision needed
Acceptance criteria for retest
Regression surface
Dependencies / related findings
Issue/PR link
Human owner/decision when required
```

## 4. Setup and private-beta preflight

### UAT-SET-01 — Production-like environment (A/C)

**Action:** identify the approved candidate and deploy/verify production-like Neon/PostgreSQL, R2 `MEDIA_BUCKET`, Cloudflare Access, transactional email, and analytics configuration.

**Expected:** candidate/build identity is unambiguous and every required service boundary needed by active UAT is available without exposing secret values.

### UAT-SET-02 — Catalogue volume (A/C)

**Action:** prepare the private-beta catalogue.

**Expected:** 10–20 reviewed artists, 30–50 reviewed tracks, and five published editorial collections exist.

### UAT-SET-03 — Catalogue audit (A)

**Action:** run `npm run catalogue:audit` against the intended candidate/data set.

**Expected:** zero missing required metadata, media, artwork, and review records.

### UAT-SET-04 — UAT identities/cohort (H/C)

**Action:** prepare one invited submitter, one authorized Cloudflare Access curator, and 20–50 invited listeners.

**Expected:** required identities/cohort exist without credentials/tokens appearing in evidence.

### UAT-SET-05 — Browser/device matrix (H/C)

**Action:** prepare desktop Chrome or Edge, Firefox, Safari/WebKit, Android Chromium, and iOS Safari/WebKit.

**Expected:** tested environments are recorded explicitly.

### UAT-SET-06 — Native assistive technology (H/C)

**Action:** prepare VoiceOver, TalkBack, and NVDA environments/testers.

**Expected:** environments are available or explicitly recorded as `BLOCKED`/`DEFERRED`.

A missing prerequisite stays visible in the report; it is never silently dropped.

## 5. Public catalogue and discovery

### UAT-CAT-01 — Published catalogue only (A/C)

Open the home page.

**Expected:** published catalogue loads and unpublished/archived/private material does not appear.

### UAT-CAT-02 — Public entity pages (A/C)

Open representative artist, release, and track pages.

**Expected:** stable URL, correct title/artwork/credits, and a playable public audio asset appear.

### UAT-CAT-03 — Search (A/C)

Search for a known artist, release, and track.

**Expected:** each query returns the intended result.

### UAT-CAT-04 — URL-backed filters (A/C)

Apply genre, mood, process, and applicable media filters; reload/share the URL.

**Expected:** results and active filters remain represented in the URL. A media filter does not imply a required public video catalogue.

### UAT-CAT-05 — Editorial collections (A/C)

Open all five prepared editorial collections.

**Expected:** ordered published tracks load and each track is playable or intentionally unavailable with a clear state.

### UAT-CAT-06 — Public disclosure/privacy (A/C)

Open the reviewed disclosure for an accepted track.

**Expected:** public rights/process/provenance context appears; private notes, hidden roles/tools, evidence, object keys, curator data, and private evidence do not.

**Catalogue blocker:** unpublished/private content exposure, unexpected absence of required published content, or disclosure of non-public data.

For missing/fallback artwork, wrong credits, misleading controls, or layout breakage, capture a full screenshot and annotate it even if the underlying diagnosis is already known.

## 6. Audio playback, queue, analytics, and recovery

### UAT-PB-01 — Start public audio (A/C)

Start representative published audio tracks from the catalogue/entity pages.

**Expected:** native audio controls enable and `playback_started` is recorded for successful starts.

### UAT-PB-02 — Queue and collection attribution (A/C)

Queue two tracks from an editorial collection and play the first.

**Expected:** queue order is retained and collection attribution remains attached to relevant lifecycle analytics.

### UAT-PB-03 — Playback lifecycle (A/C)

Pause, seek, resume, skip, replay, and complete representative audio playback.

**Expected:** controls behave correctly and semantic lifecycle events are captured once with sensible progress.

### UAT-PB-04 — Unavailable asset (A/C)

Attempt to play a deliberately unavailable track/asset fixture when available.

**Expected:** a clear unavailable state is shown and no false successful playback event is emitted.

### UAT-PB-05 — Signed URL/network recovery (A/C)

Interrupt the network or exercise the documented expired-delivery retry path without persisting a signed URL in evidence.

**Expected:** failure is explained and Retry obtains fresh playable delivery without losing the selected item/queue.

### UAT-PB-06 — Playback-start reliability sample (A)

Run 100 explicit play attempts across representative **audio** tracks/assets in the production-like environment.

**Expected:** more than 98% produce `playback_started`. Record attempt count, successful starts, failures, median, p95, and failure classes in `evidence/metrics/`.

### UAT-PB-07 — Median start latency (A)

Measure request-to-start timing for the same agreed sample/profile.

**Expected:** median playback start is below 1.5 seconds.

### UAT-PB-08 — Byte range delivery (A)

Request `Range: bytes=0-1023` from a fresh signed audio-media URL without persisting the URL or credentials.

**Expected:** response is `206`, has a valid `Content-Range`, and returns exactly 1,024 bytes.

**Playback blocker:** start reliability is not above 98%, median start is 1.5 seconds or more, recovery fails, or listener analytics/logs leak a signed URL/private request data.

## 7. Submission and curator review

### UAT-SUB-01 — Invitation-backed draft (H/C)

Open an invitation and save a complete draft.

**Expected:** draft persists and is accessible only through the intended invitation boundary.

### UAT-SUB-02 — Submit and acknowledge (H/C)

Submit with all required declarations.

**Expected:** submission becomes `received` and the submitter receives the configured acknowledgement email.

### UAT-SUB-03 — Invalid lifecycle transition (A/C)

Attempt direct acceptance before the required listening/review path.

**Expected:** transition is rejected and no acceptance is recorded.

### UAT-SUB-04 — Curator lifecycle and audit (H/C)

Move a valid submission through eligibility review to listening and acceptance.

**Expected:** permitted transitions succeed; accepted declaration revisions and curator activity remain immutable/auditable.

### UAT-SUB-05 — Allowed private evidence at the limit (H/C)

Upload a 20 MiB allowed-MIME private evidence file.

**Expected:** upload succeeds and remains private.

### UAT-SUB-06 — Invalid private evidence (A/C)

Attempt SVG/archive/unsupported MIME and a file over 20 MiB.

**Expected:** invalid upload is rejected before storage/hash completion with an understandable error.

### UAT-SUB-07 — Accepted public disclosure (A/C)

Open public disclosure after acceptance.

**Expected:** private evidence, private notes, invitation details, and non-public role/tool declarations remain excluded.

**Submission blocker:** public invitation/evidence access, successful invalid transition, missing required immutable review history, or private data appearing publicly.

Never embed invitation tokens or private-evidence URLs in the report PDF. Redact report derivatives while keeping private raw evidence securely.

## 8. Curator access, timed publication, policy, and recovery

### UAT-CUR-01 — Unauthorized curator access (A/C)

Visit curator routes without authorized Cloudflare Access identity.

**Expected:** access is denied.

### UAT-CUR-02 — Authorized curator access/audit (H/C)

Visit curator routes with the authorized curator identity and perform a harmless auditable action.

**Expected:** curator functions are available and actor/timestamp are recorded.

### UAT-CUR-03 — Public policy pages (A/C)

Open privacy, submission/terms, takedown, accessibility, and other required policy links.

**Expected:** required public policy pages load and remain usable without curator authentication where intended.

### UAT-CUR-04 — Isolated restore drill (H)

Follow the documented provider/database recovery procedure: create/use a protected backup/restore point and restore to an explicitly isolated environment.

**Expected:** migrations, catalogue audit, public audio playback, private-evidence isolation, curator Access, governance/publication history, and required row/count/checksum checks validate in the restored environment.

The DevAI must not initiate a destructive production reset or provider restore without explicit human authorization.

### UAT-CUR-05 — Recovery exercise record (H/C)

Record restore point/provider reference, operator, start/end time, elapsed time, validation results, and isolated-environment cleanup confirmation.

**Expected:** recovery evidence is sufficient for a maintainer to understand what was actually restored and verified without exposing credentials.

### UAT-CUR-06 — Prepared release publication under 15 minutes (H/C)

Start from a prepared/reviewed release that is ready for the curator publication workflow and time the human curator through the required final publication steps.

**Expected:** the prepared release becomes correctly published in **under 15 minutes**, the publication/audit history records the action, the public release/track surfaces become correct, and elapsed time is saved under `evidence/metrics/`.

If scheduled publication is used, verify the intended instant/timezone and actual batch-publication result rather than treating “scheduled” state as publication success.

**Curator/recovery blocker:** unauthorized curator access, missing required policy access, failed isolated restore validation, or prepared-release publication taking 15 minutes or more.

## 9. Accessibility and browser review

### UAT-A11Y-01 — Desktop keyboard/engines (C)

Use Chrome/Edge, Firefox, and Safari/WebKit; navigate the critical public and applicable form/player journeys by keyboard.

**Expected:** visible focus, logical heading/navigation order, usable search/filter/player/queue/forms, and no blocking horizontal overflow.

### UAT-A11Y-02 — Android/iOS usability (H/C)

Browse, search, queue, play, and navigate the relevant public journey on Android Chromium and iOS Safari/WebKit.

**Expected:** controls remain usable and layouts do not block the journey.

### UAT-A11Y-03 — Reduced motion (A/C)

Enable reduced-motion preference.

**Expected:** scrolling/focus/animated behavior respects the preference.

### UAT-A11Y-04 — Native assistive technology (H/C)

Use VoiceOver, TalkBack, and NVDA to complete representative discovery and playback/form journeys.

**Expected:** labels, status/error announcements, media controls, and focus changes are understandable.

**Accessibility blocker:** any unresolved Critical/High accessibility defect prevents navigation, selection, playback, queue/recovery, form completion, or policy access.

Automated accessibility scans support these checks but do not replace real keyboard/AT evidence.

## 10. Invited listener cohort and analytics

### UAT-COHORT-01 — Invite 20–50 listeners (H)

Send the private-evaluation invitation with scope, privacy notice, supported browsers, playback troubleshooting, product-feedback route, and separate technical-incident route.

**Expected:** cohort size and communication scope are recorded.

### UAT-COHORT-02 — Run the agreed evaluation window (H)

Run the agreed cohort period.

**Expected:** evaluation window completes and technical incidents/product feedback are captured through the intended routes.

### UAT-COHORT-03 — Aggregate analytics only (A/H)

Export the protected aggregate evaluation dataset/dashboard.

**Expected:** no low-volume participant-level data is published or included in the report.

### UAT-COHORT-04 — Evaluation dataset completeness (A/C)

Record invited count, first sessions, second sessions, playback sample size, starts/failures, median/p95 start, failure classes, curator publication time, accessibility findings, product-feedback themes, and incidents.

**Expected:** the private-beta decision dataset is complete.

### UAT-COHORT-05 — Returning-listener threshold (A)

Calculate second-session return rate from the invited cohort.

**Expected:** at least 25% of invitees start a second session.

**Cohort blocker:** return below 25%, missing required aggregate evidence, privacy boundary failure, or unresolved Critical/High issue.

## 11. From observation to the next product increment

Every material finding gets exactly one primary next-increment classification.

### FIX

Use when the expected behavior is clear and implementation is wrong.

```text
Target user-visible/system outcome
Acceptance criteria
Regression surface
Retest UAT ID(s)
```

### REFINE

Use when the flow works but causes avoidable friction or ambiguity.

```text
Observed friction
Desired experience improvement
Constraints that remain true
Acceptance hypothesis / measurable outcome
Retest UAT ID(s)
```

### RETHINK

Use when a local patch could preserve a wrong product/workflow assumption.

```text
Decision/question to resolve
Evidence triggering rethink
Affected users/journey
Outcome revised design must achieve
Constraints/invariants
Decision required before implementation
How next UAT proves the decision
```

### INSTRUMENT

Use when the product may work but cannot be proven reliably.

```text
Missing observable signal
Why current evidence is insufficient
Minimum telemetry/diagnostic capability
Testability acceptance criterion
```

### CONFIGURE

Use when environment/deployment configuration is the primary blocker.

```text
Missing/incorrect configuration
Environment affected
Verification method without secrets
Retest UAT ID(s)
```

## 12. PDF report contract

A human-readable PDF is mandatory for every completed or explicitly stopped UAT checkpoint. Build it from the preserved run ledger, not chat/session memory.

Generate the deterministic report with:

```bash
npm run uat:report -- test-results/uat/<RUN_ID>
```

Keep all three reproducible forms:

```text
report/uat-report.md
report/uat-report.html
report/uat-report.pdf
```

### 12.1 Required report sections

1. **Cover / run identity** — product, environment, candidate, run ID, dates/timezone, testers, browser/device scope.
2. **Executive summary** — what was proven/unproven, major failures/gaps, DevAI recommendation, human decision.
3. **Result summary** — counts of `PASS / FAIL / BLOCKED / DEFERRED / NOT_RUN` and private-beta gate matrix.
4. **Journey/test results** — every required UAT ID with expected/observed/status/note/evidence.
5. **Detailed findings** — severity/type/impact, observed vs expected, reproduction, annotated screenshots, next-increment definition, retest criteria, issue/PR link.
6. **Annotated screenshot evidence** — readable size, finding-ID callouts, next-iteration definition, report-safe redaction.
7. **Metrics** — catalogue volume, playback reliability/latency sample, curator elapsed publication time, cohort/return figures where active.
8. **Unexecuted/blocked/deferred coverage** — reason, dependency, re-entry condition.
9. **Re-entry/regression plan** — exact findings and UAT IDs to rerun plus automated regression coverage where appropriate.
10. **Decision record** — DevAI recommendation, human decision, accepted risks.
11. **Evidence appendix** — manifest, sanitized metric/log summaries; never secrets/private URLs/tokens.

### 12.2 Report quality bar

A stakeholder who did not attend the run must be able to answer:

```text
What did we test and against which candidate/environment?
What listener/submission/curation journey actually worked?
What failed or remains unproven?
Did public/private boundaries hold?
Did the prepared release publish in under 15 minutes?
Did audio playback exceed 98% starts and stay below 1.5s median start?
What did the human observe and where is the screenshot evidence?
Is each issue a fix, refinement, rethink, instrumentation, or configuration problem?
What outcome is required next and how will we prove it?
Can we release now?
```

The report must not bury failures in logs, omit screenshots because a textual diagnosis exists, or convert uncertainty into confident prose.

## 13. Final decision record

Record these gates as `pass / fail / incomplete` with evidence and findings:

- Catalogue readiness: 10–20 artists, 30–50 reviewed tracks, five collections.
- Public catalogue/disclosure privacy boundary.
- Audio playback-start reliability above 98% and median start below 1.5 seconds.
- Queue/lifecycle analytics and signed-delivery recovery.
- Submission and curator workflow including transactional acknowledgement.
- Curator Access/private-evidence boundary.
- **Prepared release publication in under 15 minutes.**
- Isolated restore drill.
- Accessibility/browser review with no unresolved Critical/High blocker.
- Listener cohort of 20–50 and at least 25% second-session return.

**DevAI recommendation:** GO / ITERATE / STOP

**Human maintainer decision:** GO / ITERATE / STOP

**Decision date and signer:**

**Known residual risk and follow-up issues:**

### Decision rules

- **GO** only when every required private-beta gate has measured evidence, no unresolved blocker contradicts the criteria, and the human maintainer accepts documented residual risk.
- **ITERATE** when a meaningful product slice is proven but defects, product gaps, UX/design issues, or incomplete evidence require another increment.
- **STOP** when a Critical privacy/access failure, release-blocking defect, failed foundational recovery/playback gate, or insufficient evidence makes release evaluation unsupported.

A partial run may still produce a strong **ITERATE** or **STOP** checkpoint report. Never force the run to completion merely to obtain a final-looking PDF.

## 14. DevAI completion checklist

Before declaring the UAT checkpoint complete:

- [ ] Candidate SHA/environment/build identity is recorded.
- [ ] `docs/product-scope.md` and `docs/private-beta-evaluation.md` were used for product/release gates.
- [ ] Every attempted UAT step has a status and evidence reference.
- [ ] Every unattempted required step is explicitly `NOT_RUN` or `DEFERRED`.
- [ ] Human notes are preserved before diagnosis.
- [ ] Raw screenshots are preserved unchanged.
- [ ] Material visual findings have annotated screenshot derivatives.
- [ ] Annotated screenshots identify the issue and next-increment resolution/rethink definition.
- [ ] Every material non-pass observation maps to a finding.
- [ ] Every finding has impact, classification, and retest acceptance criteria.
- [ ] Metrics/log evidence is summarized without exposing secrets/signed URLs/private participant data.
- [ ] Public video is not treated as a required MVP gate unless product scope changes.
- [ ] Catalogue volume is measured against 10–20 artists, 30–50 reviewed tracks, and five collections.
- [ ] Curator publication time under 15 minutes is measured.
- [ ] Audio playback start reliability and latency thresholds are measured.
- [ ] Cohort/return gate is measured when making the beta release decision.
- [ ] PDF contains results, findings, screenshots, metrics, unresolved coverage, and re-entry criteria.
- [ ] DevAI recommendation and human release authority remain clearly separated.
- [ ] `uat-report.md`, `uat-report.html`, and `uat-report.pdf` are saved under the run directory.

The DevAI must not state **UAT complete**, **release ready**, or **GO** while any required item above is knowingly false.
