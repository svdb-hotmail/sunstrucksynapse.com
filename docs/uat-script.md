# Sunstruck Synapse user acceptance test and evidence protocol

Use this protocol against a production-like Sunstruck Synapse Radio deployment with real, rights-cleared catalogue content.

Before a run, read the candidate/PR acceptance criteria together with:

1. `AGENTS.md`, `VILLAGE_CHARTER.md`, and `village.config.yml` for agent authority;
2. `docs/product-scope.md` for the MVP product boundary;
3. `docs/private-beta-evaluation.md` for private-beta release thresholds;
4. `docs/database.md`, `docs/media-protection.md`, and the operations/recovery documentation for infrastructure boundaries;
5. this protocol for UAT evidence and reporting.

Automated tests and code inspection are supporting evidence, not user acceptance. A UAT test is `PASS` only when the expected behavior is actually observed against the identified candidate and evidence is recorded.

## 0. Product and release scope

Sunstruck Synapse Radio is a human-curated listening destination for intentional AI-assisted music. Private-beta UAT must prove the listener, submission, curation, publication, privacy, analytics, recovery, and accessibility experience inside the MVP.

Required private-beta thresholds:

- prepared catalogue: **10-20 artists, 30-50 reviewed tracks, five published collections**;
- invited cohort: **20-50 listeners**;
- returning-listener gate: **at least 25% of invitees start a second session**;
- curator release-preparation gate: **a prepared release is published in under 15 minutes**;
- playback-start reliability: **above 98%**;
- median playback start: **below 1.5 seconds** on the agreed production-like broadband profile;
- isolated provider/database restore drill: verified;
- accessibility: no unresolved Critical/High defect in the required journey.

### Public video is not a beta release gate

`docs/product-scope.md` excludes a public video catalogue from the MVP. Public playback reliability/latency UAT is therefore measured against representative audio tracks. Video may be tested as additional evidence when relevant, but absence of a public video catalogue is not an MVP failure unless product scope changes.

### Analytics vocabulary is deliberate

The current analytics contract records `catalogue_impression`, `collection_view`, `play_requested`, `playback_started`, `listen_30_seconds`, `completion`, `skip`, `replay`, `playback_error`, `share`, and `outbound_artist_click`.

Pause, seek, and resume must work as player controls, but they are not separate analytics event names. UAT must not invent event types that the product does not define.

## 1. Governed UAT execution

UAT does not introduce a substitute `DevAI` authority. AI-assisted work follows the named Kobold Village roles in `AGENTS.md`.

### 1.1 Responsibilities

**Human tester / maintainer**

- performs steps requiring real editorial judgment, privileged credentials, physical devices, assistive technology, destructive/provider recovery actions, or human release authority;
- may correct an agent interpretation, while the original observation remains in the notes;
- owns product trade-offs, accepted risks, Ready-for-Review transitions, and the final `GO / ITERATE / STOP` decision.

**Chieftain**

- coordinates the UAT run and candidate identity;
- executes safe automatable checks and browser journeys that do not cross a human-only boundary;
- co-tests one step at a time with the human when observation/judgment is required;
- records observations before diagnosis;
- preserves admissible evidence and compiles checkpoint reports;
- never converts a non-pass result into `PASS` because a plausible fix was found.

**Shaman**

- maps active issue/Epic acceptance criteria and Definition of Done to measurable UAT evidence;
- performs the independent acceptance gate required by the repository workflow;
- escalates material ambiguity to the human rather than silently redefining acceptance.

**Warden Quality**

- independently challenges whether the evidence would detect a meaningful regression;
- reviews result classification and testability gaps before the human is asked to consider acceptance.

Use `warden-security`, `warden-canon-data`, or other relevant Wardens when the tested contract crosses their domain. Wardens remain read-only governance guards.

**Taskmaster / Villagers**

- may author bounded test/reproduction code through the normal delegation chain when implementation work is required;
- Villagers do not execute validation commands, browser checks, builds, or UAT;
- fixing a UAT finding follows the normal Village implementation workflow and is separate from the acceptance observation that found it.

### 1.2 Execution modes

1. **Human-led** - the human executes; Chieftain records and reports.
2. **Governed co-test** - Chieftain guides or automates safe parts; the human performs/judges the required step.
3. **Governed automated check** - Chieftain executes a safe automatable UAT check; Shaman/Warden acceptance remains independent where required.

### 1.3 Execution labels

- **A - Automatable:** Chieftain may execute when safe access/environment exists.
- **C - Co-test:** Chieftain can automate or guide parts, but human observation/judgment may be needed.
- **H - Human:** human action/approval is required.

Compound labels have explicit precedence:

- **A/C:** execute as A when no human-only judgment/privileged boundary is crossed; otherwise execute as C.
- **H/C:** human action is mandatory; Chieftain may co-guide. `H` wins.
- **A/H:** human authorization/access is mandatory before Chieftain may automate; until authorization exists the test is `BLOCKED`. The human may instead execute the step directly.

### 1.4 Result vocabulary

Every active test ends in exactly one status:

- **PASS** - expected behavior observed and evidence exists.
- **FAIL** - observed behavior contradicts the requirement.
- **BLOCKED** - prerequisite/environment/permission/dependency prevents meaningful execution.
- **DEFERRED** - human maintainer deliberately postpones the test and records why.
- **NOT_RUN** - no attempt has been made yet.

`BLOCKED`, `DEFERRED`, and `NOT_RUN` never count as passes.

### 1.5 One-step co-test loop

1. Identify the next UAT ID and prerequisite.
2. State one action.
3. State the expected result.
4. State what evidence/observation is needed.
5. Record the human/system observation before interpretation.
6. Record status and rationale.
7. For a material non-pass, create/update a finding and annotated evidence.
8. Continue only after the current step is recorded.

If the human says **stop**, stop immediately and compile a checkpoint report. Remaining required tests stay `NOT_RUN`.

## 2. Run workspace and evidence safety

Use the ignored run tree:

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

Recommended `RUN_ID`: `YYYY-MM-DD_<short-sha>_<environment>`.

`run.md` records candidate/build/environment identity, human tester(s), participating governed roles, browser/device matrix, non-secret configuration state, catalogue/cohort preparation, known pre-existing issues, stop/resume timestamps, Chieftain recommendation, Shaman/Warden gate outcome where applicable, and human maintainer decision.

`notes.md` is chronological and append-oriented. Preserve observations such as "nothing happened", "it scrolled to the top", "the cover art is missing", or "I did not receive an email". Add later diagnosis underneath; never replace the source observation.

### 2.1 Secrets are not evidence

Never record or retain passwords, database/provider credentials, authorization headers, cookies, invitation tokens, private-evidence bearer URLs/tokens, signed media URLs, or other reusable secrets in the UAT package.

Before saving a screenshot/log, screen it for prohibited secrets. If a secret was captured accidentally:

1. do **not** retain that capture as raw evidence;
2. remove it from the run tree immediately;
3. revoke/rotate the credential when it may still be reusable;
4. recapture the evidence without the secret.

Raw-evidence immutability applies only after the evidence is admissible and secret-free.

Non-secret sensitive information, such as personal information that is necessary to evidence a finding, may be kept in access-controlled raw evidence and represented in the report only through an irreversibly redacted derivative.

### 2.2 Screenshot standard

For admissible screenshots:

- preserve the original unchanged in `screenshots/raw/`;
- create a separate derivative in `screenshots/annotated/`;
- keep full context even when a crop is additionally useful;
- use text labels plus visual callouts;
- redact non-secret sensitive data on the report derivative.

Recommended names:

```text
<UAT-ID>_<sequence>_<description>_raw.png
<UAT-ID>_<sequence>_<description>_annotated.png
```

Annotated finding plates include finding ID/severity/type, observed, expected, why it matters, next increment (`FIX / REFINE / RETHINK / INSTRUMENT / CONFIGURE`), definition of resolved or rethink decision, and retest acceptance criterion.

### 2.3 Finding record

Each material non-pass in `findings.md` records:

```text
Finding ID
Source UAT test ID(s)
Status: OPEN / ACCEPTED_RISK / FIXED_PENDING_RETEST / CLOSED
Severity: Critical / High / Medium / Low
Type: DEFECT / PRODUCT_GAP / UX_FRICTION / DESIGN_RETHINK / TESTABILITY_GAP / ENVIRONMENT_CONFIG
Observed behavior
Expected behavior
User/product impact
Evidence references
Reproduction steps
Environment/candidate
Verified diagnosis, if known
Next increment classification
Definition of resolved OR rethink decision needed
Acceptance criteria for retest
Regression surface
Dependencies / related findings
Issue/PR link
Human owner/decision when required
```

## 3. Setup and private-beta preflight

- **UAT-SET-01 (A/C):** identify candidate/build and production-like Neon/PostgreSQL, R2 `MEDIA_BUCKET`, Cloudflare Access, transactional email, and analytics configuration. Expected: every required boundary is available without exposing secrets.
- **UAT-SET-02 (A/C):** prepare 10-20 reviewed artists, 30-50 reviewed tracks, and five published editorial collections.
- **UAT-SET-03 (A):** run `npm run catalogue:audit`. Expected: zero missing required metadata, media, artwork, and review records.
- **UAT-SET-04 (H/C):** prepare one invited submitter, one authorized curator, and 20-50 invited listeners without tokens/credentials in evidence.
- **UAT-SET-05 (H/C):** record desktop Chrome/Edge, Firefox, Safari/WebKit, Android Chromium, and iOS Safari/WebKit coverage.
- **UAT-SET-06 (H/C):** prepare VoiceOver, TalkBack, and NVDA or record the relevant check `BLOCKED`/`DEFERRED`.

## 4. Public catalogue and discovery

- **UAT-CAT-01 (A/C):** home page exposes published catalogue only.
- **UAT-CAT-02 (A/C):** representative artist/release/track pages have stable URLs, correct title/artwork/credits, and playable public audio.
- **UAT-CAT-03 (A/C):** known artist/release/track search returns the intended results.
- **UAT-CAT-04 (A/C):** genre/mood/process/applicable media filters survive reload/share through URL state; media filtering does not imply public-video MVP scope.
- **UAT-CAT-05 (A/C):** all five collections preserve order and each track is playable or intentionally unavailable with a clear state.
- **UAT-CAT-06 (A/C):** accepted-track disclosure exposes public rights/process/provenance context but not private notes, hidden data, evidence, object keys, curator data, or private evidence.

**Blocker:** unpublished/private exposure, required published content missing unexpectedly, or public disclosure of non-public data.

## 5. Audio playback, queue, analytics, and recovery

- **UAT-PB-01 (A/C):** start representative published audio. Expected: native audio controls work and successful starts record `playback_started`.
- **UAT-PB-02 (A/C):** queue two collection tracks and play first. Expected: order persists and collection attribution remains on relevant analytics.
- **UAT-PB-03 (A/C):** pause, seek, resume, skip, replay, pass 30 seconds, and complete. Expected: controls work; implemented `listen_30_seconds`, `skip`, `replay`, and `completion` occur at correct moments without duplication. No pause/seek/resume events are required.
- **UAT-PB-04 (A/C):** unavailable asset has clear unavailable state and no false successful playback event.
- **UAT-PB-05 (A/C):** exercise network/expired-delivery recovery without retaining signed URLs. Expected: Retry obtains fresh playable delivery without losing selected item/queue.
- **UAT-PB-06 (A):** run 100 explicit play attempts across representative audio. Expected: **more than 98%** produce `playback_started`; record attempts, successes, failures, median, p95, and failure classes.
- **UAT-PB-07 (A):** median request-to-start for the same sample/profile is **below 1.5 seconds**.
- **UAT-PB-08 (A):** request `Range: bytes=0-1023` from fresh signed delivery without retaining URL/headers. Expected: `206`, valid `Content-Range`, exactly 1,024 bytes.

**Blocker:** start reliability is not above 98%, median is >=1.5 seconds, recovery fails, or analytics/logs leak secret delivery data.

## 6. Submission and curator review

- **UAT-SUB-01 (H/C):** invitation-backed complete draft persists through the intended invitation boundary.
- **UAT-SUB-02 (H/C):** submit required declarations. Expected: status becomes `received` and configured acknowledgement email is actually received.
- **UAT-SUB-03 (A/C):** direct acceptance before required listening/review is rejected with no acceptance recorded.
- **UAT-SUB-04 (H/C):** eligibility review -> listening -> acceptance works and reviewed declaration revisions/curator activity remain immutable/auditable.
- **UAT-SUB-05 (H/C):** allowed 20 MiB private evidence upload succeeds and remains private.
- **UAT-SUB-06 (A/C):** SVG/archive/unsupported MIME and >20 MiB evidence are rejected before storage/hash completion with understandable errors.
- **UAT-SUB-07 (A/C):** accepted public disclosure excludes private evidence/notes, invitation details, and non-public role/tool declarations.

Invitation tokens and private-evidence URLs are bearer credentials. They must not exist in retained screenshots, raw evidence, notes, or the PDF. If accidentally captured, follow section 2.1 and recapture.

**Blocker:** public invitation/evidence access, successful invalid transition, missing immutable review history, or private data appearing publicly.

## 7. Curator access, publication, policy, and recovery

- **UAT-CUR-01 (A/C):** curator routes deny unauthorized access.
- **UAT-CUR-02 (H/C):** authorized curator functions work and harmless actions record actor/timestamp.
- **UAT-CUR-03 (A/C):** `/privacy`, `/submission-terms`, and `/takedown` load publicly and links remain usable. Accessibility is tested behaviorally; no phantom standalone accessibility page is required.
- **UAT-CUR-04 (H):** use a **protected Neon restore point or protected database backup** and restore to an explicitly isolated environment. A catalogue export is supplemental evidence only and is never accepted as the restore source. Validate migrations, catalogue audit, public audio, private-evidence isolation, curator Access, governance/publication history, and required row/count/checksum checks.
- **UAT-CUR-05 (H/C):** record provider/restore reference, operator, start/end/elapsed time, validation results, and isolated cleanup confirmation without credentials.
- **UAT-CUR-06 (H/C):** time a human curator from a prepared/reviewed release through final publication. Expected: correctly published in **under 15 minutes**, audit history records the action, public release/track surfaces are correct, and elapsed time is stored in `evidence/metrics/`. For scheduled publication, prove intended instant/timezone and actual batch publication; `scheduled` state alone is not success.

The agent must not initiate a destructive production reset/provider restore without explicit human authorization.

**Blocker:** unauthorized curator access, missing policy access, failed isolated restore, or publication time >=15 minutes.

## 8. Accessibility and browser review

- **UAT-A11Y-01 (C):** keyboard journey in Chrome/Edge, Firefox, Safari/WebKit. Expected: visible focus, logical order, usable search/filter/player/queue/forms, no blocking overflow.
- **UAT-A11Y-02 (H/C):** Android/iOS browse/search/queue/play/navigation remains usable.
- **UAT-A11Y-03 (A/C):** reduced-motion preference is respected.
- **UAT-A11Y-04 (H/C):** VoiceOver, TalkBack, and NVDA can complete representative discovery/playback/form journeys with understandable labels/status/errors/media controls/focus.

**Blocker:** unresolved Critical/High accessibility defect blocks a required journey. Automated scans support but do not replace real keyboard/AT evidence.

## 9. Invited listener cohort and analytics

- **UAT-COHORT-01 (H):** invite 20-50 listeners with evaluation scope, privacy notice, supported browsers, troubleshooting, product feedback route, and separate incident route.
- **UAT-COHORT-02 (H):** run the agreed evaluation window and capture incidents/feedback through intended routes.
- **UAT-COHORT-03 (A/H):** export the protected aggregate evaluation dataset only after required human authorization/access. Expected: no low-volume participant-level data is published or included in the report.
- **UAT-COHORT-04 (A/C):** record invited count, first/second sessions, playback sample, starts/failures, median/p95, failure classes, curator publication time, accessibility findings, feedback themes, and incidents.
- **UAT-COHORT-05 (A):** calculate second-session return rate. Expected: **at least 25%** of invitees start a second session.

**Blocker:** return below 25%, missing aggregate evidence, privacy boundary failure, or unresolved Critical/High issue.

## 10. From observation to next increment

Classify each material finding exactly once:

- **FIX:** clear expected behavior is implemented incorrectly. Define target outcome, acceptance criteria, regression surface, and retest IDs.
- **REFINE:** flow works but causes avoidable friction/ambiguity. Define desired improvement, constraints, measurable acceptance hypothesis, retest IDs.
- **RETHINK:** evidence suggests the interaction/workflow/model is wrong. Define the decision, evidence, affected journey, desired outcome, invariants, decision needed, and how next UAT proves it.
- **INSTRUMENT:** behavior may work but cannot be proven. Define missing signal, evidence gap, minimum telemetry/diagnostics, and testability criterion.
- **CONFIGURE:** environment/deployment configuration blocks behavior. Define missing/incorrect config, affected environments, safe verification, and retest IDs.

## 11. PDF report contract

A human-readable PDF is mandatory for every completed or explicitly stopped UAT checkpoint. Build it from the preserved run ledger, not session memory.

Generate with:

```bash
npm run uat:report -- test-results/uat/<RUN_ID>
```

Keep `uat-report.md`, `uat-report.html`, and `uat-report.pdf` under the run's `report/` directory.

Required report sections:

1. cover/run identity;
2. executive summary - proven/unproven scope, major findings, Chieftain recommendation, human decision;
3. result summary - all result counts and beta gate matrix;
4. journey/test results - every required UAT ID, expected/observed/status/note/evidence;
5. detailed findings;
6. annotated screenshot evidence;
7. metrics - catalogue, playback, curator publication, cohort/return where active;
8. unexecuted/blocked/deferred coverage and re-entry condition;
9. re-entry/regression plan;
10. decision record - Chieftain/Shaman/Warden evidence where applicable plus human decision/accepted risks;
11. evidence appendix with sanitized summaries only.

A stakeholder who did not attend must be able to determine what was tested, what actually worked, what remains unproven, whether public/private boundaries held, whether publication was <15 minutes, whether playback exceeded 98% and median stayed <1.5s, what the human observed, how each finding is classified, what must change, and whether release is supportable.

## 12. Final decision record

Record `pass / fail / incomplete` with evidence/findings for:

- catalogue readiness: 10-20 artists, 30-50 tracks, five collections;
- public catalogue/disclosure privacy boundary;
- audio playback start reliability >98% and median <1.5s;
- queue/lifecycle analytics and delivery recovery;
- submission/curator workflow including actual transactional acknowledgement;
- curator Access/private-evidence boundary;
- prepared release publication <15 minutes;
- isolated protected-backup/restore drill;
- accessibility/browser review with no unresolved Critical/High blocker;
- 20-50 listener cohort and >=25% second-session return.

**Chieftain recommendation:** GO / ITERATE / STOP

**Shaman / Warden acceptance evidence:**

**Human maintainer decision:** GO / ITERATE / STOP

**Decision date and signer:**

**Known residual risk / follow-up:**

Decision rules:

- **GO** only when every required private-beta gate has measured evidence, independent governance gates required by `AGENTS.md` are satisfied, no unresolved blocker contradicts criteria, and the human accepts residual risk.
- **ITERATE** when a meaningful slice is proven but defects, gaps, UX/design issues, or incomplete evidence require another increment.
- **STOP** when Critical privacy/access failure, release-blocking defect, failed recovery/playback gate, governance breach, or insufficient evidence makes release evaluation unsupported.

A partial run may produce a strong `ITERATE` or `STOP`. Never force completion merely to make the report look final.

## 13. Completion checklist

Before declaring a UAT checkpoint complete:

- [ ] Candidate SHA/environment/build identity is recorded.
- [ ] Product scope/private-beta criteria and repository agent authority were used.
- [ ] Active acceptance criteria map to UAT/evidence.
- [ ] Every attempted step has status/evidence; every required unattempted step is `NOT_RUN`/`DEFERRED`.
- [ ] Human observations were preserved before diagnosis.
- [ ] No bearer secret/credential was retained as evidence; accidental captures were removed and rotated/revoked when needed.
- [ ] Admissible raw screenshots are unchanged and visual findings have annotated report-safe derivatives.
- [ ] Every material non-pass maps to a finding with classification and retest criteria.
- [ ] Public video is not a required MVP gate unless scope changes.
- [ ] Analytics checks use the implemented event vocabulary.
- [ ] Public policy checks match `/privacy`, `/submission-terms`, `/takedown`.
- [ ] Catalogue volume, <15-minute publication, playback reliability/latency, and cohort/return gates are measured when required.
- [ ] Restore evidence uses a protected database restore source, never a catalogue export as the source.
- [ ] Required Shaman/Warden acceptance evidence is recorded.
- [ ] PDF includes results, findings, screenshots, metrics, unresolved coverage, and re-entry criteria.
- [ ] Human release authority remains distinct from agent recommendations.
- [ ] All three report forms exist under the run directory.

No agent may state **UAT complete**, **release ready**, or **GO** while a required item above is knowingly false.
