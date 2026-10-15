# Curation implementation traceability

## Curator editing continuation, 15 October 2026

PR #91 was merged by the maintainer. The subsequent request authorizes curator artwork and presentation-metadata corrections for legacy and current submissions. See [curator editing and rollout](curator-submission-editing.md). This continues the SOLO exception; no independent acceptance is claimed. The maintainer stopped direct image-upload work and owns UAT. Cloudflare website UI use requires asking first; use API/CLI for authorized operations. This increment remains a separate Draft PR, with forward migration 0015 required before deployment.

Status: implementation complete on `feat/curation-listening-workflow`; automated validation is
intentionally deferred to the pull-request workflow at the maintainer's request.

## Human authority exception

On 2026-09-07 the maintainer explicitly instructed Codex to bypass the repository's Village
execution chain, continue solo, and not activate other agents without later permission. Work after
that instruction was implemented and reviewed by the primary agent only. Earlier partial outbox
work is retained with its original provenance. This record makes the exception visible rather than
presenting the normal independent-gate lineage as completed.

## Requirement to implementation

- Curator starts intake: `/curator/submissions` issues a time-limited private submission URL;
  only the token hash is retained and the raw link is shown once for copying.
- Artist supplies input: invitation-backed drafts now include a direct-to-R2 private review-audio
  uploader with bounded declarations, a 15-minute staged PUT, streaming checksum verification,
  immutable sealed object versions, replacement selection, and expired-staging cleanup.
- Curator listens: `/curator/review-audio/:audioId` is Cloudflare Access protected, private/no-store,
  and byte-range capable. Review audio is separate from public derivatives and has no public route.
- Curator assesses: the production scorecard captures four independent 1–5 observations—artistic
  quality, originality/intent, production readiness, and editorial fit.
- Curator grades: A, B, or C is selected explicitly; no numeric average or threshold exists.
  Eligibility remains a separate deterministic preflight. A means accepted with feature
  distinction, B accepted, C declined.
- Near-zero touch: **Review next ready submission** exclusively claims the oldest eligible item.
  Finalization pins exact declarations and audio, records an immutable review, updates the
  submission, creates draft catalogue entities for A/B, records activity, and enqueues notification
  in one SQL statement.
- Publication boundary: no grade publishes, schedules, or pins homepage content. Production track
  scheduling/publication now checks accepted-review, media, artwork, metadata, and release blockers;
  the readiness-audit boolean predicate was corrected to use the same acceptance intent.
- Operations: the scheduled Worker cleans incomplete staging objects and leases/dispatches
  decision-email outbox jobs with bounded retries and sanitized codes. Curators see pending,
  processing, and failed notification counts.
- Historical integrity: no existing terminal submission is backfilled with an invented grade.

## Artifacts

- Database: migrations `0009_curation_outbox.sql`, `0010_cool_human_cannonball.sql`,
  `0011_enforce_curation_parentage.sql`, and `0012_audit_submission_invitations.sql`, schemas,
  repositories, immutability/integrity triggers, and exact inventory updates.
- Runtime: review-audio signing/sealing service, upload/playback routes, outbox dispatcher, cron
  cleanup/dispatch, atomic grading and draft-catalogue preparation.
- UI: production `ReviewAudioUploader` and `CurationScorecard` components plus light/dark Storybook
  stories.
- Tests authored: outbox repository behavior, review-audio declaration/signature behavior,
  curation atomicity, and the browser no-audio decision boundary. They were not executed locally.
- Operations: `.env.example`, database/deployment documentation, R2 token/CORS requirements, and
  the curator workflow guide.

## Evidence boundary

No test suite, build, lint, type check, browser check, migration apply, database deployment, or
Cloudflare deployment was run after the maintainer said to stop tests and let the PR workflow do the
rest. Migration generation and Prettier authoring were run; these are not behavioral validation.
The PR must remain Draft until the maintainer decides whether to mark it Ready for Review. In this
repository CI skips Draft PRs, so workflow evidence will not exist until that human transition.

## 15 October: automatic preparation continuation

The maintainer's SOLO exception remains active. The latest “go” authorizes the artist-cover/single-or-album intake and automatic streaming preparation contract. See [implementation, focused evidence and deployment status](launch-automatic-publishing.md). No independent acceptance is claimed. The maintainer enabled Workers Paid on 15 October; the private encoder is deployed and passed an isolated R2/container smoke test. PR #91 is Ready at the maintainer's explicit direction; its media-integrity and album-flow comments are addressed. Application deployment remains a separate step, and the maintainer owns UAT.

## PR 92 review fixes — 15 October 2026

Maintainer requested all comments fixed and then merge. SOLO exception remains active; no subagents or manufactured independent acceptance. Migration 0015 was applied in isolated Neon and production (16 journal entries, 40 tables, 67 foreign keys; catalogue/submission/review/job counts unchanged). Its committed SQL is preserved exactly. Follow-up 0016 closes legacy release-only editing without rewriting migration history.

Review fixes require published associations for canonical and signed media delivery; fully decode artwork through the existing private encoder container before storing it; use consistent catalogue lock order; return saved editor revisions inside the transaction; retain cleared descriptions; show shared release fields read-only for pending existing-album members; retry publication view loads if the revision changes; and preserve identical publish retry behavior. Original artist evidence and accepted review pins remain unchanged. Human UAT is deferred to the maintainer; focused checks and normal PR CI provide smoke evidence. Cloudflare website UI and direct artist image attachment remain prohibited.

## Curator preview UAT fix — 15 October 2026

The maintainer reported artwork disappearing after save and an unusable native Play control in Publishing. Read-only production inspection confirmed the selected curator artwork, its R2 object, and the prepared MP3 were present; no artist media was uploaded, reassigned or deleted by the agent. The artwork loader incorrectly returned binary bytes from a page module with a default component, so React Router handled it as an HTML document. A dedicated authenticated resource route now delivers the cover, existing preview URLs redirect to it, and the save response supplies its URL while page data revalidates. Publishing loads the first ready track with metadata preloading, so the native Play control works without a separate Audition selection. Track switching commits the selected source before playing under the user gesture.

Focused regression checks exercise the actual React Router request handler and registered resource modules: exact PNG delivery, authenticated access, old-link redirect, missing-object rejection and MP3 byte-range streaming. UI checks cover the initial native audio source and saved-cover rendering during revalidation. The existing SOLO exception, private-media boundaries, explicit publication action and human UAT preference remain active. No schema migration or production content mutation is required.
