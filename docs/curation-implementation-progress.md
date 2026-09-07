# Curation implementation progress

Status: paused at the maintainer's request on 2026-09-07. All implementation workers are stopped. This is an incomplete local checkpoint, not a validated or deployable increment.

## Restart instruction

Read this file and the repository agent contract, then continue on `feat/curation-listening-workflow`. Finish and review ticket #36-A first. Do not repeat the completed architecture investigation or recreate the schema/migration. The maintainer asked to stop quickly and resume later. No automated continuation is scheduled.

## Authorized direction

The maintainer requested execution of the near-zero-touch curation plan: invited artists supply music and metadata; curators listen, assess four 1–5 criteria and give a final grade; the system prepares catalogue drafts and notifications. Publication remains a separate human decision. Following the continuations and the announced default, Shaman admitted A = accept with feature distinction, B = accept, C = decline. A does not automatically publish, schedule or pin content. The four independent criteria are artistic quality, originality/intent, production readiness and editorial fit; eligibility is separate and unweighted.

Keep React Router, Workers, Neon HTTP/Drizzle, R2, Access and Postmark. Use a PostgreSQL transactional outbox and the existing scheduled Worker. Do not introduce another workflow state store. Private review audio must be distinct from evidence and public derivatives.

## Workspace checkpoint

- Branch: `feat/curation-listening-workflow`, created from fetched `origin/main`.
- Existing maintainer change: `worker-configuration.d.ts`; preserve and exclude from this work.
- Added draft schema: `app/db/schema/curation-outbox.ts`, exported by `app/db/schema/index.ts`.
- Generated migration: `drizzle/0009_curation_outbox.sql`, journal entry and snapshot.
- Added `aws4fetch@1.0.20` for private upload presigning. Its default signer excludes Content-Type: the implementation must use `allHeaders: true` and test that Content-Type is actually signed.
- Initial repository implementation is saved in `app/repositories/curation-outbox.server.ts`: SQL insert builder, enqueue, lease claim, acknowledge and retry. The author was interrupted immediately after writing it; it has not completed review or validation.
- No dispatcher, grading, audio intake or curator UI implementation yet. Taskmaster B prepared its packet sequence but dispatched no audio implementation.
- No tests, builds or type checks run. Migration generation completed successfully; this is not validation evidence.
- These files are being saved in a local WIP checkpoint commit. No PR or deployment has been created; no remote push is requested for this pause.

## Readiness and execution evidence

Both Elder consultations recommended the existing stack with atomic review writes and a transactional outbox. Their key guardrails are separate eligibility and editorial assessment, deterministic catalogue identity, private review audio, immutable reviews, and explicit publication readiness.

Shaman admitted the bounded outbox foundation under Phase 5 #9 / #36, based on merged earlier-phase delivery despite stale open issue state. The Taskmaster assigned a bounded schema packet to a previously completed advisory agent, explicitly reassigned to Villager Builder. Schema authoring completed; execution initially stopped due to workspace credits, then resumed. The initial repository packet was written before the maintainer requested this pause. No independent acceptance is claimed.

Shaman also admitted private audio intake independently: invitation-authorized artist upload belongs to a submission, with no pre-existing catalogue track required. Presigned PUT targets staging only. Finalization verifies size/type/checksum and seals bytes into a separate immutable key within the same private review-audio class to prevent staging PUT replay from mutating reviewed music. Curator playback requires Access and range support. Only incomplete staging uploads receive automatic cleanup.

## Resume sequence

1. Finish the outbox ticket through its Taskmaster: review the existing parameterized SQL builder, exclusive claims, token-guarded acknowledge/retry, expired-lease recovery and attempt exhaustion. Add immutable-success and shared `updated_at` triggers to migration 0009. Author focused database tests. Update `scripts/validate-database.ts`'s exact table/index/check/trigger inventory: its unchanged table list currently makes the new schema fail that harness. The repository currently takes the concrete Neon `Database` type; make its execution boundary compatible with real PGlite tests without unsafe double casts. Repeated acknowledge currently returns false after success; review intended idempotency semantics. Compare JSON size validation to PostgreSQL JSONB text size. No runtime callers use the repository yet.
2. Implement the admitted private-audio intake ticket with scoped presigning, staging verification/sealing, invitation checks, curator-only range playback, upload UI, and meaningful contract tests. Document required R2 S3 credentials/CORS without adding secrets.
3. Shaman has already admitted #36-C grading schema/service with the A/B/C semantics above. Implement versioned immutable reviews, automatic claiming and atomic completion. Obtain admission for the following deterministic automatic draft catalogue ticket. Do not fabricate historical grades.
4. Add the focused listening/assessment UI and production-component Storybook coverage; keep detailed declarations and exceptions accessible.
5. Wire the outbox dispatcher and operational retry visibility. Make publication readiness shared by publication commands and the readiness audit; fix the existing audit predicate.
6. Perform independent quality, security and data reviews. Follow the maintainer's preference for PR CI rather than local test suites. Open a Draft PR; the current CI workflow skips the quality gate on drafts, so report that evidence boundary explicitly without changing the workflow or marking Ready without authorization.

No database migration or deployment has been applied. Existing submissions must not receive fabricated historical grades.

## Agent restart map

- `/root/taskmaster_outbox`: completed its coordinator turn, awaiting repository packet review and the next bounded trigger/test packets.
- `/root/elder_wisdom`: explicitly reassigned to Villager Builder by the outbox Taskmaster; interrupted after repository file authoring. Resume only through that Taskmaster.
- `/root/elder_doubt`: explicitly reassigned to Taskmaster B; interrupted after preparation, before child dispatch. Its sequence is schema, repository/sealing, API/playback routes, artist UI, focused tests, documentation; each is a separate bounded packet.
- Shaman's prior admissions are recorded above. Reuse them rather than restarting all readiness investigation.
