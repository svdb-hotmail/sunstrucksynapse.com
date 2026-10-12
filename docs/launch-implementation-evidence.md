# Cloud launch implementation evidence

12 October 2026, Europe/Brussels. Implements the human-authorized cloud continuation
and launch plan #84. The recorded SOLO exception remains active: no other agents,
Village ceremonies, independent gate verdicts, independent reviews or production content
were created. The maintainer still decides Ready and merge.

## Delivered code

- L1, #85: production curator shell, real paginated queue/search/filters, one private
  audition player, exclusive next/selected claim, four independent assessments,
  explicit grade/rationale, actor/submission-scoped browser drafts, finalized decision
  and next claim, compact invitation creation with one-time secret reveal.
- L2, #86, based on L1: `/curator/albums` groups accepted draft tracks under an explicitly
  selected primary artist and album, reorders without changing track IDs, edits required
  metadata, uploads separate public listening assets and one cover, previews presentation,
  shows blockers, and performs one confirmed atomic publication command. Review uploads
  revalidate in place. Original isolated draft parents remain; accepted declarations,
  reviews and private review objects remain untouched. No migration.
- L3, based on L2: Play album replaces the queue with album order; Queue album appends
  playable tracks. Album scope/queue attribution survives storage restoration. Transport
  stays within the album at its end. Public album shelf, numbers/durations, operational
  canonical/share URLs, robots and public-only sitemap. Integration follow-ups preserve
  secure evidence controls and log the previous grouping in preparation audit.

Public media is always deliberately selected and uploaded again. No private review
object is automatically copied, relabelled or served as public audio. Short SQL table
locks serialize album commands with legacy catalogue writers. Neon HTTP batch is the
transaction boundary; R2 uploads complete beforehand and are not part of that transaction.
Draft retention is local to this browser/tab, not a server review draft or cross-device sync.
Queue search, filters and counts now run in the repository before pagination and share the claim eligibility predicate. Pagination retains the selected search and filter.

## Focused verification

- Strict TypeScript and touched-source ESLint: passed.
- Curation: seven isolated PostgreSQL tests, including exclusive claimed-row ownership,
  immutable decision/draft creation, stale identity and exact parentage; six route tests.
- Album: four isolated PostgreSQL transaction tests covering regroup lineage, rejected
  selection rollback, rejection with private-only media, full reordered publication,
  publication retry/audit idempotency and prevention of edits after publication.
- Existing media-service checks: 18 passed. Playback coordinator: 13 passed, including
  signed-source renewal preserving playback position and stale asynchronous requests.
- Queue/storage/sitemap: 15 passed. Public privacy filtering, album ordering and persistence.
- Production client and Worker build: passed. This is not browser playback evidence.
- Existing invitation/submission/review browser checks were adapted to the production UI;
  album desktop playback and mobile/theme journeys were added without weakening the
  audio, declaration, curation or publication gates.

Browser execution is outstanding. Cloudflare preview initially failed because sandbox
network-interface enumeration is denied. A temporary test-process-only loopback fallback
allowed preview to start; no such workaround was committed. Chromium was unavailable;
Playwright's browser download returned truncated/non-ZIP bodies. No successful browser
journey, screenshot, mobile layout measurement or real new-album playback is claimed.

The broad CI workflow is intentionally Draft-gated and only targets `main`. For stacked
PRs, retarget each to `main` after its predecessor merges, then let the maintainer decide
Ready. No tests were disabled, skipped, relaxed or bypassed to obtain green evidence.

## Actual launch status and access needed

No production database records, schema, R2 objects, Worker secrets, Access settings or
Worker deployment were changed. Existing public root returned HTTP 200, and anonymous
`/curator/submissions` returned HTTP 302 to Cloudflare Access during this continuation.
These responses are the existing deployed application, not the implementation stack.

GitHub, Neon and Cloudflare connectors now work under the maintainer's Hotmail account. Neon project `sunsyn` is `frosty-sunset-21512292`; the default production branch is `br-tiny-bird-b2zobncr`. Isolated verification uses child branch `br-divine-silence-b2q6v9do` (`sunsyn-launch-verification-20261012`) and its separate database `launch_verification_20261012`. Synthetic test records exist only in that database; no production content was fabricated.

Cloudflare account `f9db1511596713616ac19b4f7538d337` exposes the existing Worker `sunstruck-synapse-radio`, its media bucket and required secret binding names. Production R2 CORS permits the operational domain and www variant. The active deployed version remains `0266c696-64c9-4875-a4b1-1713689092e8` from 12 September. Secret values were not read or replaced; binding presence does not prove the exact runtime DATABASE_URL target.

Actual Neon HTTP repository verification passed assembly with unchanged accepted links, invalid-selection rollback and rejection of private-only assets. The long first setup exceeded its timeout while applying the existing migrations and fixtures in the new isolated database. A later full-publication case exceeded its per-test timeout after publication; it is not reported as a passing complete journey. A focused follow-up used the actual repository/Neon HTTP batch twice and passed: publication retries return the same slug, the four artist/release/track publication audit entries remain unchanged, and both tracks retain exact accepted declaration/review links. Separate readback confirms ordered published tracks, deliberately separate public-audio metadata and one applied cover. Synthetic media metadata is not proof of actual R2 upload/playback. See `docs/launch-neon-verification.md`.

Ready/merge and broad CI remain maintainer-controlled. After merges, confirm the deployed Worker target, deploy the approved code and verify the actual curator submission/upload and listener journeys. Access curator login is still needed for that signed-in browser verification. No migration is needed for the launch code.

The maintainer submits and curates each real track, assembles the album once, selects its
public cover/listening files, resolves blockers and publishes. Record that submitter and
curator are the same maintainer. Verify signed-out album playback, complete order, seeking,
renewal, navigation, cover/share/canonical URLs and mobile themes before calling it launched.
Reversal uses existing audited archive/hide operations; do not delete review/submission history.

Dependency triage is recorded separately in `docs/launch-dependency-triage.md`; Draft #88 now uses a coherent Vitest 4.1.11 runner update and passes the high-severity audit gate (zero critical/high, four moderate Drizzle tooling package nodes).
