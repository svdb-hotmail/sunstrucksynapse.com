# SunSyn launch recovery plan

Assessment date: 2026-10-11, Europe/Brussels. Baseline: `main` at
`35aa5020c708895c8e685eacad5cda7bd546d25a`.

## Launch outcome and maintainer direction

Launch a useful public listening site with at least one complete album by the maintainer.
The maintainer will enter the music through the submission flow and review it personally.
Their later clarification supersedes the initial request to skip curation: use actual
submissions, actual decisions, and the normal publication boundary. Do not manufacture an
independent review or a historical grade.

The normal curator job is to listen, assess four parameters, choose a grade, and move on.
The application handles eligibility, persistence, catalogue preparation, and notifications.
Release preparation is one album-level task, rather than a chain of lifecycle buttons for
every artist, release, and track. Final publication remains an explicit curator action.

This is a focused first public release. It is not evidence that the larger private-beta
cohort, catalogue-size, return-rate, recovery, and performance targets in issue #9 and
`docs/private-beta-evaluation.md` have been met. Those targets remain tracked separately.

The maintainer's recorded solo-work exception remains in force; no Village agents were
activated for this assessment. No independent acceptance gate is claimed.

## Verified as-is state

| Area                       | Evidence                                                                                                                                                       | Consequence                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Source baseline            | Latest fetched `main` is `35aa502`; PR #82 is merged.                                                                                                          | Start launch work from current main, not an old submission branch.                                          |
| CI                         | Main CI run [34677985687](https://github.com/svdb-hotmail/sunstrucksynapse.com/actions/runs/34677985687) passed for that commit.                               | Existing CI is useful baseline evidence, not album-journey proof.                                           |
| Live public site           | Homepage, search, About, privacy, submission terms, and takedown returned HTTP 200.                                                                            | The production application already serves public traffic.                                                   |
| Public audio               | Existing published audio returned HTTP 206 and `bytes 0-1023/27659598` for a 1,024-byte range.                                                                 | R2/signed public delivery works for one existing WAV; browser listening still needs a journey check.        |
| Curator access             | Anonymous requests to `/curator` and `/curator/submissions` reached Cloudflare Access sign-in.                                                                 | Preserve the existing authentication boundary.                                                              |
| Catalogue                  | Configured SunSyn database contains one published artist, one release, and one track.                                                                          | The full album is not present yet.                                                                          |
| Submissions                | Two drafts and two `eligibility_review` track submissions; the two review candidates have private audio plus attested rights and finalized process/provenance. | Existing candidates can exercise review; no review or publication should be fabricated.                     |
| Decisions                  | No `curation_reviews` rows.                                                                                                                                    | Successful acceptance-to-publication has not been demonstrated in current data.                             |
| Migrations                 | All 13 journal entries, `0000`–`0012`, are recorded; latest journal timestamps agree.                                                                          | There is no outstanding `0011` apply on this inspected database.                                            |
| Migration lineage          | Several old hashes match CRLF variants; `0006` matches committed historical version `4b9902b`.                                                                 | Document the applied history. Do not rerun old SQL or overwrite ledger hashes to make them match.           |
| Jobs                       | Nine successful review-audio staging-cleanup jobs; no decision-email jobs in the inventory.                                                                    | Staging cleanup has evidence; decision-email delivery does not yet.                                         |
| Design work                | PRs #75–#81 remain open Draft prototypes. Storybook returns HTTP 200.                                                                                          | Attractive previews are not production integration.                                                         |
| Other PRs                  | #61 has an old failed quality gate; #83 dependency update has passed checks.                                                                                   | Triage independently; neither replaces the album work.                                                      |
| Canonical links            | `SITE_URL` is `https://sunsyn.art`; that host timed out in this assessment. Operational host is `sunstrucksynapse.com`.                                        | Use the working domain for launch canonical/share links until a separate domain transition is verified.     |
| Search engine entry points | `/robots.txt` and `/sitemap.xml` returned 404.                                                                                                                 | Small launch follow-up; not the cause of broken publishing.                                                 |
| Deployment control         | Wrangler could not list Worker deployments without account credentials.                                                                                        | Deployed commit, current secret inventory, and new deployment remain unverified from account-side evidence. |

The database findings refer to the existing `SUNSYN_DATABASE_URL` supplied to this session.
Its published catalogue corresponds to the live track. Worker-side database configuration
still needs account-side confirmation before any write or migration is applied.

The original checkout has 132 modified paths; an ignore-line-ending diff showed no content
changes. It was left untouched. The clean assessment checkout is
`sunstrucksynapse-launch`, branch `agent/launch-recovery-plan`.

## Actual blockers in the product journey

1. **The working curator route still uses the listener shell.** `app/root.tsx` composes
   `ApplicationShell` around every outlet. The queue/review design in Storybook has not
   replaced the production form cards.
2. **Intake is single-track.** `app/routes/submission.tsx` sets `submissionKind: "track"`
   and uploads one review copy per submission. Full album intake is not implemented.
3. **Acceptance creates isolated catalogue parents.** `finalizeReview()` in
   `app/repositories/curation-workflow.server.ts` creates a new artist, a release named
   after the track, and one track at position 1 for each A/B decision. It does not
   assemble the submitted release information into a shared album.
4. **Publication requirements cannot all be completed in the UI.**
   `publicationBlockers()` requires genre, moods, and process tags. The current curator
   forms, `UpdateEntityInput`, and update API only support title/slug. Track grouping,
   positions, and primary artist selection also lack an editing command.
5. **Private listening audio is intentionally separate from public audio.** Acceptance
   creates draft catalogue records, not a ready public audio asset. The current public
   upload asks the curator to enter duration/codec or image dimensions manually. This is
   necessary preparation with unnecessary manual work around it.
6. **Publishing exposes internal state machinery.** Artists, releases, and tracks require
   separate draft/review/schedule/publish actions; there is no album readiness screen and
   single immediate publication command.
7. **An album page has individual Play/Queue buttons, but no album play action.**
   Automatic advancement uses the global catalogue unless a queue was explicitly built.
   Album order must be a deliberate playback contract, not an accident of catalogue order.

Source entry points: `app/routes/curator-submissions.tsx`, `app/routes/curator.tsx`,
`app/routes/curator-entities.ts`, `app/services/curator.server.ts`,
`app/repositories/curator.server.ts`, `app/routes/release.tsx`, and
`app/components/EntityTrackList.tsx`.

## Target journey

```text
Artist: invitation -> essentials -> automatic file upload -> submit -> receipt

Curator: Ready queue -> listen -> four assessments -> grade + rationale
         -> Finish and next -> accepted tracks appear in release preparation

Release: choose artist + album -> select/order accepted tracks -> cover + public audio
         -> resolve visible blockers -> preview -> Publish album

Listener: open album -> Play album -> tracks play in order -> browse without losing audio
```

Keep readiness reasons visible. Missing input belongs next to the field/action that fixes it.
Technical eligibility and workflow transitions are application responsibilities. Waiting
and rejection remain exceptions. Successful saves stay in place and failure preserves input.

## Three launch PRs

These are new functional increments from current main. Each starts as Draft and can be
handed to another developer using its scope, source entry points, and acceptance checks.
Keep them stacked in the order below; production can receive each merged increment.
Merge/Ready decisions remain with the maintainer.

### L1 — Dedicated working curator queue and review

Suggested branch: `agent/launch-curator-workspace`, base `main`.

Reuse the relevant production design tokens/components from #75–#79 and the approved
queue/review prototypes. Do not make the launch depend on merging listener account/voting
prototypes. Resolve any selective extraction against current main explicitly.

Implement a dedicated curator layout, compact searchable queue, filters, selected-track
preview, and a focused listening/review panel. Use real server data and the existing
Cloudflare Access-protected audio route. Wire the existing exclusive claim and atomic
review commands. Persist the current review input and distinguish a saved draft from a
finalized decision. After successful finalization, claim/select the next ready submission.
Keep invitation creation compact and preserve the existing one-time private-link reveal.

Acceptance:

- Curator routes show no listener hero or competing public player.
- A ready row can be auditioned; only one private player plays at a time.
- Four assessments, explicit A/B/C grade, and rationale finalize once and select the next
  eligible item. Double-submit or stale claims do not create duplicate reviews/entities.
- Failures stay local and retain the curator's input. No ready items produces a useful
  empty state. Score/grade shortcuts do not intercept typing or focused form controls.
- Light/dark and keyboard use share the same production components demonstrated in
  Storybook; fixtures remain fixtures and are never substituted for real route data.

Focused verification: claim/finalization service regression checks and one browser journey
covering queue -> private listen -> decision -> next. Run broad CI in the PR workflow.

### L2 — Prepare and publish an ordered album

Suggested branch: `agent/launch-album-publishing`, base L1.

Add one release-preparation screen using the existing artist/release/track schema. Choose
an existing artist or deliberately create one, select accepted draft tracks, assign them
to one album, edit titles/positions/discovery fields, and apply one album cover. Reuse
approved existing artist records only through explicit curator selection; do not merge
identities by display-name similarity.

Add validated, audited commands for metadata and draft-track regrouping/reordering. Retain
track IDs and their accepted submission/review links. Preserve old draft records; deleting
or retroactively rewriting them is not a launch requirement.

Improve the existing separate public-media upload with automatic image dimensions,
duration, MIME normalization, and clear progress/retry states. Public listening files are
deliberately selected for publication. The reviewed private object remains private. For
tonight the same local recording can be selected again as a separate public upload;
automatically copying private review audio into public storage is not an assumed policy.
MP3/M4A listening files reduce transfer size; WAV remains a supported launch input if the
actual playback checks pass. No transcoding service is required for this increment.

Provide a readiness panel with exact blockers and a public preview. `Publish album`
validates every selected track, media, artwork, credits, parent identity, and pinned
declarations, then publishes the eligible artist/release/tracks as one audited database
operation. Preserve acceptance and publication as different actions. A partial failure
must not expose a partly published album. Repeated requests return the existing result.
R2 preparation completes before publication; database atomicity is not an R2 transaction.

Acceptance:

- Multiple accepted track submissions become one correctly credited, ordered release.
- Genre/mood/process metadata and artwork blockers can be fixed without SQL or manual
  duration, checksum, codec, or image-dimension entry.
- Invalid or unaccepted tracks remain unpublished; their exact blockers are shown.
- One confirmed action publishes the complete album and supplies its working public URL.
- Refresh/retry does not duplicate publication audit or change retained review history.

Expected persistence approach: existing schema first. If a constraint or audit requirement
requires a migration, create a forward migration and test it against an isolated branch;
do not edit applied migrations or perform a production reset/seed.

Focused verification: regroup/reorder constraints, rejected publication rollback, retry
idempotency, media scope checks, and one prepared-release publication journey.

Tonight's intake limitation is explicit: use one track submission per track, then assemble
the album once in this screen. Avoid inventing an album-submission protocol before the
publication path works. A release-aware multi-track intake is the first later convenience
increment if this repeated input is burdensome; it is not already delivered.

### L3 — Album listening and launch integrity

Suggested branch: `agent/launch-album-listening`, base L2.

Add `Play album` and `Queue album` using the persistent player/queue. Play uses a scoped
ordered release queue and does not append unrelated tracks accidentally. Define replacement
of an existing queue visibly. Show track number and duration, link the album from the
homepage, and keep listener controls compact on desktop/mobile in both themes.

Use `sunstrucksynapse.com` for canonical and share URLs while that is the verified working
domain. Add basic robots/sitemap responses covering published content; private invitation
and curator routes must not be advertised. Existing search genres are sufficient for the
first launch; a genre directory can reuse #81 later.

Acceptance:

- A signed-out listener opens the album and plays every published track in album order.
- Pause, seek, next/previous, queue, and navigation work without conflicting players.
- Expired media URL recovery retains the track and position; failures explain how to retry.
- Cover, album links, and share/canonical URLs resolve on the operational domain.
- No fixture catalogue, empty placeholder shelf, or simulated voting/login control appears
  as a real production feature.

Focused verification: ordered playback/queue unit checks and one desktop plus one mobile
album listening spot-check. Verify actual browser playback, not only an HTTP audio range.

## Launch checklist

1. Confirm the Worker database/bucket match the intended production environment. Confirm
   deployed version, Access configuration, R2 CORS, and required secret presence through
   connected Cloudflare tooling or existing account credentials. Never paste secrets into
   the plan, PR, or test evidence.
2. Make a recoverable database/provider restore point before new schema or album writes.
   Preserve current submissions and public content. No cleanup is indicated by this audit.
3. Complete L1–L3, resolve actionable review feedback, and run the normal PR quality gate.
   Deploy merged code through the existing Worker build trigger and check the live domain.
4. Maintainer submits/reviews their tracks, prepares the album, and publishes it. Record the
   fact that the maintainer is both submitter and curator; no independent review is claimed.
5. In a fresh signed-out browser, verify the complete album, cover, order, Play album,
   navigation continuity, mobile controls, seeking/ranges, and media URL renewal.
6. Verify accepted declarations, private-media exclusion, and clear failure recovery.
   If any required track cannot play, the album is not launch-ready.
7. Record the deployed commit, public album URL, verification, limitations, and rollback
   action. Archive/hide through the normal audited catalogue command if publication must
   be reversed; do not delete submissions, reviews, or audio history.

The deadline is a target, not a verified ETA. At assessment time, three real product gaps
still require implementation and deployment access is absent. Do not promise tonight's
album publication based on Storybook or the previous green CI alone.

## Immediately after the first launch

Prioritize improvements from real use:

1. Release-aware multi-track intake: shared album/artist declarations entered once, per-track
   exceptions, ordered uploads, resumable progress. Preserve per-track reviewed lineage.
2. Integrate the reusable invitation-management prototype only where it reduces actual
   curator work. Keep one-time secret handling and clear replace/revoke semantics.
3. Integrate listener genre browsing with production metadata. Keep public listening open.
4. Listener identity plus five weekly downvotes and rotation remains a separate increment.
   It needs persistent sessions/votes, cutoff and tie rules, participation/abuse controls,
   and an auditable rotation job. Existing stories simulate this; none is a launch promise.
5. Agent assistance: deterministic eligibility and metadata checks first; later agents can
   propose tags, describe risks, or draft notes. Store the actor and evidence for suggestions.
   Human grade and publication stay explicit. Use the same validated application commands;
   agents do not gain direct database/storage write authority.
6. Run the larger beta/recovery/accessibility/performance evaluation and reconcile stale
   Phase 3–5 issue status with delivery evidence. Do not mark an Epic complete from this plan.

## Handover and evidence limits

Current work is the assessment/plan only. No production records, schema, R2 objects, Worker
configuration, or production UI were changed. No broad test suite was run. Source review,
GitHub status, read-only SQL inventory, and HTTP spot-checks support the findings above.

Outstanding verification: authenticated curator browser journey, new submission upload,
decision-email delivery, album preparation/publication, multi-track browser playback, live
Worker version/secrets, and actual restore procedure. The new PRs must supply that evidence.

Storybook: [shared remote preview](https://sunsyn-curator-preview.pages.dev/).
Prototype stack: [#75](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/75),
[#76](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/76),
[#77](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/77),
[#78](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/78),
[#79](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/79),
[#80](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/80), and
[#81](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/81).
