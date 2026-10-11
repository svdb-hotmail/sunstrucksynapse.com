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
Queue search/filter counts currently describe the loaded page; pagination remains explicit.

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

GitHub connector access worked. No Git-shell, DATABASE_URL, SUNSYN_DATABASE_URL or
Cloudflare credential variables were present. Connected Neon project search for `sun`
returned no project; this does not prove there is no project in another account.

To deploy/verify after maintainer merges: authorized Cloudflare account access for the
existing `sunstruck-synapse-radio` Worker (deployment/version and secret/binding inspection),
Access curator login, and access to the intended Neon production project/branch. Confirm
Worker DATABASE_URL, MEDIA_BUCKET/public-review storage scopes, R2 CORS and configured
signing/upload secrets against the actual production target. Do not paste secret values.
Take a recoverable restore point before real album writes. No migration is needed.

The maintainer submits and curates each real track, assembles the album once, selects its
public cover/listening files, resolves blockers and publishes. Record that submitter and
curator are the same maintainer. Verify signed-out album playback, complete order, seeking,
renewal, navigation, cover/share/canonical URLs and mobile themes before calling it launched.
Reversal uses existing audited archive/hide operations; do not delete review/submission history.

Dependency triage is recorded separately in `docs/launch-dependency-triage.md`.
