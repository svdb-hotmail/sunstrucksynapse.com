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
