# SunSyn cloud continuation checkpoint

Created 2026-10-12, Europe/Brussels. The maintainer requested moving the active launch
implementation to cloud execution. Local implementation stops after this checkpoint is
pushed and the cloud continuation is dispatched.

## Objective and authority

Implement the launch plan from PR #84, with intuitive submission and low-touch human
curation. The maintainer will submit and curate their own album through the real flow.
Their clarification supersedes the initial request to skip curation.

The maintainer's explicit solo-work exception remains active. Do not activate Village
agents or other subagents. Use the existing design system and Storybook components.
Run focused checks on the changed behavior; use the PR workflow for broad testing.
Open implementation PRs as Draft. Do not mark Ready, merge, or weaken tests without the
maintainer's explicit instruction.

## Repository and branch

- Repository: https://github.com/svdb-hotmail/sunstrucksynapse.com
- Main baseline: `35aa5020c708895c8e685eacad5cda7bd546d25a`.
- Continue `agent/launch-curator-workspace`; do not replace it with an old local branch.
- Launch plan: PR #84, branch `agent/launch-recovery-plan`,
  `docs/launch-recovery-plan.md`, commit `973ecf7`.
- Storybook: https://sunsyn-curator-preview.pages.dev/
- Production application: https://sunstrucksynapse.com/

The launch branch contains three reused prototype commits, applied cleanly to current
main: `c29db05` (foundation), `02fe0ef` (queue), and `96cbdbd` (review). These are the
existing work from #75–#77, not new production wiring. This checkpoint adds documentation.
No production UI, data, R2 object, configuration, or schema change has been deployed.

## Next implementation

Read the plan from PR #84 and implement its three increments:

1. L1: dedicated curator shell, real compact queue, private audition, claimed focused
   review, retained draft input, final decision, automatic next item, compact invitation
   creation. Branch `agent/launch-curator-workspace`.
2. L2: select accepted tracks into one artist/album, order tracks, edit required discovery
   metadata, upload cover/public listening files with automatic metadata, show readiness,
   publish the complete album once through an audited, atomic, retry-safe command.
   Suggested branch `agent/launch-album-publishing`, stacked on L1.
3. L3: ordered Play/Queue album, continuous public playback, operational canonical/share
   URLs, homepage album entry and launch checks. Suggested branch
   `agent/launch-album-listening`, stacked on L2.

Do not stop at more fixture prototypes or another plan. Wire the actual server contracts.
Listener accounts, voting, agent recommendations, and broad album intake redesign are
later work. For the first launch, per-track submissions can be assembled once into the
album preparation screen.

## Findings already collected

- Latest main CI passed. Public routes respond, existing audio supports a valid range,
  and curator routes redirect anonymous clients to Cloudflare Access.
- Configured SunSyn database: one published track/release/artist, two draft submissions,
  two eligibility-review submissions with audio/declarations, no completed curation
  reviews, nine successful staging-cleanup jobs.
- All 13 migration entries through 0012 are recorded. Old migration hash differences
  were explained by Windows line endings and historical 0006 at `4b9902b`. Do not reset,
  seed production, rerun applied SQL, or rewrite ledger hashes.
- Ten open dependency alerts are development-scoped. Their reachable paths still need
  triage; #83's green isolated mocker update does not resolve the whole dependency graph.
- No Cloudflare account credentials were available locally. Plugin search found no
  available Cloudflare connector. The deployed Worker commit and secrets were not read.
- Public canonical URLs currently point to `sunsyn.art`, which timed out; use the verified
  operational `sunstrucksynapse.com` for launch until a domain transition is verified.

## Code entry points and likely first edits

- `app/root.tsx` currently wraps every route in `ApplicationShell` and the public player.
  Split private curator/submission presentation cleanly without conditional hook calls.
- `app/routes/curator-submissions.tsx` already contains authorized loader/action logic,
  paginated aggregate reads, claim-next, atomic grading, clarification and invitation
  creation. Its rendered UI is still long legacy form cards.
- `app/features/curator-workspace/` now holds the reusable shell, queue, preview, review,
  typed views, fixtures, and stories. Adapt real aggregates through a typed adapter.
- `ReviewWorkspace.tsx` is controlled. Replace prototype-only saved text, add pending/error
  state and useful playback failures, and protect keyboard shortcuts in form controls.
- `app/repositories/curation-workflow.server.ts` supplies exclusive queue claims and
  atomic finalized decisions. Acceptance currently creates a separate artist/release and
  track at position 1 for every accepted submission.
- `app/repositories/curator.server.ts` publication blockers require accepted review,
  public media, artwork, genre, moods, process tags, and ready parents. Update commands
  currently only expose title/slug, leaving publication blockers unfixable through UI.
- `app/components/ReviewAudioUploader.tsx` already uploads on file selection; completion
  currently reloads the page. Keep saved details locked, errors actionable, and progress
  local. Review audio must remain separate from public listening audio.
- `app/routes/release.tsx` and `EntityTrackList.tsx` lack album play/queue controls;
  `app/root.tsx` advances through the global catalogue unless the queue is built.
- `cloudflareContext.curationWorkflowRepository` is a narrow injected contract used by
  focused route tests; extend its type and fixtures together if a new method is needed.

## Environment and verification

Use the cloud repository environment and its connected GitHub/Neon/Cloudflare access.
No local credentials or database URL values are copied into this handoff. The Windows
environment variable name is `SUNSYN_DATABASE_URL`; scripts/app use `DATABASE_URL`.
Do not assume either exists in cloud or points at an isolated database. Identify the
target before any write; keep live data intact. Use synthetic fixtures and isolated
databases for verification.

No new test suite/build was run after this continuation started. The three prototype
commits carry their earlier focused verification, not proof of production integration.
Inspect `tests/unit/curation-workflow*`, `curator-routes`, and the submission E2E tests.
Select checks that would catch broken claiming, duplication, private-media leaks,
publication rollback, or wrong album order. Do not run the entire suite repeatedly.

Push each completed increment and create/update its Draft PR with concrete behavior,
tests, remaining limits, base/head relationships, and the solo exception. Continue
independent implementation if deployment access is missing, then report the exact
remaining access requirement. Never claim launch or real browser playback from a
successful build alone.
