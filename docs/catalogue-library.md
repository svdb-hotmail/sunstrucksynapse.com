# Catalogue library and publication visibility

The maintainer approved the catalogue proposal on 16 October 2026. This implementation continues the explicit SOLO exception recorded in `docs/launch-cloud-handoff.md` and `docs/curation-implementation-progress.md`; no independent Village acceptance is claimed.

## Operator workflow

`/curator` is now the searchable track library. It defaults to Needs attention when there are matching attention items, otherwise All tracks. Query, view, page cursor and selected track are URL state. Counts cover the complete matching search, not only the current 25-row page. Pagination uses title plus UUID as a stable keyset. Opening and closing track details retains the view.

The details drawer explains listener visibility separately from stored lifecycle. It shows readiness blockers, private prepared-audio playback when available, an authorised cover preview, complete-release scope and recent publication history. Editorial changes use the existing revision-checked, audited submission editor. Publication and retries use the existing complete-release preparation/confirmation flow. Selecting ready tracks groups their complete releases for individual review; it does not silently batch-publish.

The older artist, release, collection, upload and lifecycle controls remain available at `/curator/tools`. Existing POST `/curator` clients retain the original commands and Access checks. Draft/archived deletion and the existing audit requirements are unchanged. New scheduling, unpublish semantics and unrestricted editing of published submissions are not introduced by this change.

Refresh is explicit unless a displayed track or the selected drawer track has a queued/processing preparation job, including attention items. Active-job refresh backs off, stops after eight foreground attempts, and pauses in hidden tabs; an idle library does not poll the database. Each refresh must finish before the next backoff timer starts, and cleanup during a request cannot restart polling.

## Visibility and incomplete publication

The public catalogue and this read model use the same published track/release/credited-artist predicate. Public listing and ready public listening media are distinct facts: a listed track with missing media is reported as an attention item, not falsely described as absent or playable.

The library uses shared exact accepted-review/media/artwork/metadata and release-level readiness queries. Pending album submissions, inconsistent covers, nonconsecutive track order and blocked siblings all prevent a Ready badge. It also exposes partial publication, failed preparation, scheduled and overdue tracks, and archived records. Database failures produce an explicit unavailable verification state with a retry path; they are never translated into an empty catalogue or fabricated non-live badges.

The release preparation screen now loads the complete selected release inventory, including already-published siblings. A published release row alone cannot trigger its completed screen. Completion requires every track to be publicly listed with ready listening media. A partial release must still match its current confirmation revision; only a truly complete publication can reuse an original revision as an idempotent retry. Published grouping/metadata edits remain guarded by the existing domain rules.

Publication also verifies the complete listener state after its updates, within the same database transaction. Missing public media on an already-published track is a blocker even when its private preparation job is ready; this command does not restore deleted published assets. Media repair remains a separate audited operation. A failed final check rolls back media registration, lifecycle updates and publication audit entries together.

No schema migration, production data mutation or deployment is included. Earthrise's live record has not been inspected or repaired here: the Neon plugin was reported connected, but this chat did not expose Neon query tools or a usable database binding. This code handles the demonstrated incomplete-publication case without assuming that it is Earthrise's exact diagnosis.

## Validation contracts

- PGlite executes the real inventory SQL against committed migrations and synthetic seed data. Cases cover public parents, unavailable media, a pending track under a published release, future/overdue schedules, keyset pages, global facets and off-page details.
- Publication tests reproduce a published-parent/incomplete-track state, reject its stale confirmation, preserve accepted evidence and private assets on failure, then verify atomic publication and duplicate retry without extra audit entries.
- Route tests verify authentication before private reads, invalid cursor rejection, and sanitised database failure responses.
- Browser journeys cover the drawer, incomplete-state explanation, URL-preserving close, search/reload, mobile viewport fit, and release-scoped selection. The existing curator control journeys continue through `/curator/tools`.
- Storybook provides the library, incomplete publication and empty-search states in the existing light/dark theme frame.

Human production UAT remains required. The application must be deployed before the live catalogue changes, and a live Earthrise repair still requires inspecting its exact production IDs and audit history through an available authorised connection.

## Critical self-review and PR follow-up

Review fixes cover false publication success after missing media, refresh eligibility independent of the derived badge, and release-level blockers shared with confirmation. Self-review additionally found that a ready track could conceal a blocked sibling, slow refresh requests could overlap, and the standalone database validator could not resolve the new runtime alias imports. These are fixed with sibling blockers, completion-based refresh scheduling, and script-compatible relative imports.

Regression coverage exercises otherwise-ready release order/cover/pending-submission failures, blocked siblings, published missing-media rejection without silent restoration, a synthetic post-update media-loss trigger proving transactional rollback, bounded foreground polling with slow/error/cleanup cases, and the browser attention-job-to-idle journey. The submitted-cover immutability triggers remain enabled in all fixtures. This is a solo self-review, not an independent acceptance verdict. Local SQL tests do not prove production R2 objects exist or diagnose Earthrise's live record.
