# User acceptance test script

Use this script against a production-like deployment with real, rights-cleared catalogue content. Record the environment, operator, date, browser/device, result, and evidence link for every step. Do not record signed media URLs, invitation tokens, passwords, contact information, or private evidence keys.

**Release decision:** The human maintainer records **GO**, **ITERATE**, or **STOP** only after every release gate has measured evidence. Any blocker below requires **STOP** or **ITERATE**.

## 1. Setup

- [ ] Deploy the approved build with production-like Neon, R2, Cloudflare Access, transactional email, and analytics bindings.
- [ ] Prepare at least 10 reviewed artists, 30 reviewed tracks, and five published collections.
- [ ] Confirm `npm run catalogue:audit` reports zero missing metadata, media, artwork, and review records.
- [ ] Prepare one invited submitter, one Cloudflare Access curator, and 20-50 invited listeners.
- [ ] Prepare desktop Chrome or Edge, Firefox, and Safari/WebKit; Android Chromium; and iOS Safari/WebKit.
- [ ] Prepare native assistive-technology environments for VoiceOver, TalkBack, and NVDA.

## 2. Public catalogue and discovery

| Step | Expected result | Result / evidence |
| --- | --- | --- |
| Open the home page | Published catalogue loads; no unpublished or archived work appears. | |
| Open artist, release, and track pages | Stable URL, correct title/artwork/credits, and a playable public asset appear. | |
| Search for a known artist, release, and track | Each query returns the correct result. | |
| Apply genre, mood, process, and media filters; reload/share URL | Results and active filters remain represented in the URL. | |
| Open each editorial collection | Ordered tracks load and each track is playable or intentionally unavailable. | |
| Open the reviewed disclosure for one accepted track | Public rights/process/provenance summary appears; private notes, hidden roles/tools, evidence, object keys, and curator data do not appear. | |

**Blocker:** unpublished/private content is exposed, published content is missing unexpectedly, or public disclosure exposes non-public data.

## 3. Playback, queue, and recovery

| Step | Expected result | Result / evidence |
| --- | --- | --- |
| Start one audio track and one video track | Native controls enable and `playback_started` is recorded. | |
| Queue two tracks from a collection, then play the first | Queue order is retained; collection attribution remains on lifecycle analytics for queued collection tracks. | |
| Pause, seek, resume, skip, replay, and complete playback | Controls work; corresponding lifecycle events are captured once with sensible progress. | |
| Start an unavailable track | Clear unavailable state; no false successful playback event. | |
| Interrupt network or use an expired signed URL, then Retry | Failure is explained; Retry obtains a fresh playable URL without losing selected item/queue. | |
| Run 100 explicit play attempts across representative audio/video assets | At least 98 produce `playback_started`; record successes, failures, median, and p95 request-to-start time. | |
| Inspect median start latency | Median is below 1.5 seconds on the agreed broadband profile. | |
| Request `Range: bytes=0-1023` from a fresh signed media URL | `206`, valid `Content-Range`, and exactly 1,024 bytes are returned. | |

**Blocker:** start rate is below 98%, median start is 1.5 seconds or more, playback recovery fails, or listener activity leaks a signed URL.

## 4. Submission and curator review

| Step | Expected result | Result / evidence |
| --- | --- | --- |
| Open an invitation link and save a complete draft | Draft persists and is accessible only via its invitation link. | |
| Submit with all required declarations | Submission changes to `received`; submitter receives the configured acknowledgement. | |
| Attempt direct acceptance before listening | Rejected with a transition conflict; no acceptance is recorded. | |
| Curator moves a valid submission through eligibility review to listening, then accepts it | Permitted transitions work; accepted declaration revisions and curator activity are immutable/auditable. | |
| Upload private evidence at 20 MiB with an allowed MIME type | Upload succeeds and remains private. | |
| Upload SVG, archive, unsupported MIME, or a file over 20 MiB | Upload is rejected before storage/hash completion with an understandable error. | |
| Open public disclosure after acceptance | Public view excludes private evidence, private notes, and non-public role/tool declarations. | |

**Blocker:** invitation or evidence access is public, an invalid lifecycle transition succeeds, or private data appears publicly.

## 5. Curator access, policy, and recovery

| Step | Expected result | Result / evidence |
| --- | --- | --- |
| Visit curator routes without Cloudflare Access | Access is denied. | |
| Visit curator routes with authorized Access identity | Curator functions are available; actions record actor and timestamp. | |
| Open privacy, terms, and accessibility/policy pages | Pages load and policy links are usable without authentication. | |
| Create a protected Neon restore point/export and restore to an isolated environment | Migration, catalogue audit, public playback, private-evidence isolation, curator Access, and publication history all validate. | |
| Record recovery exercise | Capture restore point, operator, elapsed time, row counts, checksums, outcome, and cleanup confirmation. | |

**Blocker:** unauthorized curator access, unavailable policy pages, or a failed isolated restore drill.

## 6. Accessibility and browser review

| Step | Expected result | Result / evidence |
| --- | --- | --- |
| Desktop Chrome/Edge, Firefox, and Safari/WebKit: navigate by keyboard | Visible focus, logical heading/navigation order, operable search/filter/player/queue controls, and no horizontal overflow. | |
| Android and iOS: browse, queue, play, and navigate | Controls remain usable; page does not overflow horizontally. | |
| Reduced-motion preference | Scrolling/focus movement respects reduced motion. | |
| VoiceOver, TalkBack, and NVDA: complete discovery and playback journey | Labels, status/error announcements, native media controls, and focus changes are understandable. | |

**Blocker:** any critical/high defect prevents navigation, selection, playback control, queue control, recovery, form completion, or policy access.

## 7. Invited listener cohort and analytics

- [ ] Invite 20-50 listeners with the private-evaluation scope, privacy notice, supported browsers, troubleshooting link, feedback route, and separate technical-incident route.
- [ ] Run the agreed cohort period.
- [ ] Export only aggregate dashboard data; do not publish low-volume participant-level data.
- [ ] Record: invited count, first sessions, second sessions, playback sample size, starts, failures, median/p95 start time, failure classes, curator preparation time, accessibility defects, feedback themes, and incidents.
- [ ] Confirm at least 25% of invited listeners start a second session.

**Blocker:** return rate below 25%, missing aggregate evidence, or unresolved critical/high issues.

## 8. Final decision record

| Gate | Pass / fail | Evidence | Owner / follow-up |
| --- | --- | --- | --- |
| Catalogue readiness | | | |
| Public privacy boundary | | | |
| Playback reliability and latency | | | |
| Submission and curator workflow | | | |
| Access and private evidence boundary | | | |
| Restore drill | | | |
| Accessibility and browser review | | | |
| Listener cohort and return rate | | | |

**Human maintainer decision:** GO / ITERATE / STOP

**Decision date and signer:**

**Known residual risk and follow-up issues:**
