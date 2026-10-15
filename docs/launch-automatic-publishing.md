# Automatic publishing implementation and rollout

## Delivered behavior

Artist intake now shows audio and cover requirements before selection, captures single/album intention and individual album track order, and uses searchable multi-select dropdowns for genres, moods and creative process tags. Every selected genre survives persistence and discovery filtering. Album projects are bound to the verified invitation owner; another artist cannot attach a track by copying an album ID. Covers are verified against actual image headers and sealed privately with a checksum, immutable metadata, and an explicit artist permission statement.

Accepting a track atomically creates its preparation task from the exact accepted audio/review lineage. **Accept & prepare release** opens that task; **Finish & next** continues reviewing and leaves the task in Publishing. The production publisher shows progress, private streaming audition, visible blockers and an explicit Publish single/album action. It no longer asks curators to convert or reupload a listening file or cover. A confirmation is invalidated when the displayed release changes, and the final transaction checks the confirmed ordered track IDs.

The private encoder and deployment configuration are included under `services/encoder/`. Its fixed profile and boundaries are described in [ADR 0009](architecture/decisions/0009-accepted-audio-preparation.md). Review objects remain private, track IDs and accepted declaration links are retained, and public media metadata is registered only during the atomic publication transaction.

Older accepted tracks have no invented cover or discovery choices. Their original active invitation can supply a missing artist cover without changing their accepted review; the curator can enter missing discovery choices once. Legacy grouping still uses the explicitly authorized album preparation API/advanced catalogue; new submissions carry their own artist/album intention automatically. Full-album uploads remain out of scope.

## Focused evidence, 15 October 2026

- 59 focused TypeScript tests pass across review-audio regression, acceptance navigation, cover validation/sealing, multi-genre discovery, private prepared-audio authorization/ranges, job verification and real repository publication.
- The cross-repository test exercises real draft persistence, artist-owned album selection, shared cover, exclusive claim, immutable A/B review, lease expiry, stale completion rejection, deferred public assets, atomic album publication, publication retry/audit stability, legacy missing-cover recovery and exhausted-job retry.
- Three Python checks use actual ffmpeg and generated audio: fixed output profile/checksum, source preservation and metadata stripping, wrong format/duration rejection, and HTTP source-checksum verification.
- Migration 0013 is a forward migration. All 14 migrations were applied transactionally through the Neon connector to `release_pipeline_verification_20261015`, on isolated branch `br-divine-silence-b2q6v9do` in project `frosty-sunset-21512292`. Readback confirmed 14 journal entries, four preparation tables and seven integrity triggers. No production schema or data was changed.
- Direct PostgreSQL access from this workspace fails DNS resolution. The committed `scripts/verify-release-pipeline.ts` reproduces the full Neon HTTP repository journey where direct migration access is available; it was not claimed as a successful cloud run here. The actual repository journey passed on migrated PGlite PostgreSQL.
- Strict TypeScript, touched-file ESLint, the production application build, Storybook build and encoder Worker bundle pass. After addressing PR feedback, 57 focused tests across eight affected test files pass, including atomic position reservation, draft cover adoption, two pre-existing cover leases converging on one cover, shared-cover identity protection, audited reorder/gap closure, published-track lookup and unknown commit outcomes. PGlite serializes calls; this is not a claim of testing multi-connection lock scheduling.
- Forward migration 0014 adds atomic intake reconciliation and managed-release publication guards. It was applied to the same explicitly isolated Neon database; readback confirms 15 journal entries and both new triggers. No production migration was performed during this check.
- Local Chromium exits with signal 11; the Playwright browser download is truncated by this environment. No local browser pass is claimed. Remote Storybook is used for visual review where available; production E2E remains a separate deployment check.
- Read-only Cloudflare checks confirmed the media bucket has managed public access disabled and no custom public domains. Its existing signed application delivery remains the public boundary.

## Deployment status and exact sequence

The connected Cloudflare account is `f9db1511596713616ac19b4f7538d337`. The account owner enabled Workers Paid on 15 October; a subsequent Containers API read returned HTTP 200. The agent did not change billing. A standalone TypeScript configuration issue found by the first build was fixed. Workers Builds successfully deployed both the private production encoder (`90f84968-4727-4465-81c2-b2f117165d69`) and its isolated verification counterpart (`fb24baba-38e6-4ae1-8751-b54724d3657e`) from `ea5abed9d41105c14c25ff3b0b20db6004746f05`. API readback confirms their production/preview bucket bindings and disabled public and preview URLs.

The real R2 → service binding → FFmpeg container → R2 probe passed on 15 October at 01:13 UTC, run `20261015-01`: 42,885-byte MP3, 1,045 ms, 44.1 kHz, stereo, 320,000 bit/s, with stored checksum verification, original preservation and wrong-source rejection all true. The probe schedule was then disabled and its committed default is off. This is a synthetic provider smoke test, not artist UAT or a production publication.

1. Workers Paid is enabled. The account's existing GitHub connection and build token are reused; no credentials need to be sent in chat.
2. The private encoder is deployed. Its repeatable command is `npx wrangler deploy --config services/encoder/wrangler.jsonc`, from Cloudflare Workers Builds or a Cloudflare-authenticated environment with Docker available. The service name must remain `sunstruck-synapse-encoder`.
3. The isolated provider smoke test passed. Never point preview code at the production database or private source media by default.
4. Run full PR CI through the existing maintainer Ready-for-Review gate. The maintainer explicitly requested Ready and owns artist UAT; do not repeat broad local testing. Apply committed migrations 0013 and 0014 to the explicitly identified production database with normal Drizzle migration semantics and journal hashes. Do not reset, seed or clean production.
5. Deploy the application with the `AUDIO_ENCODER` service binding included in `wrangler.jsonc`, after the encoder exists. Verify the deployed revision, invitation upload, real human review/acceptance, private preparation, explicit publication, public ranges, album playback and mobile/theme behavior. The maintainer performs the production journey with their own material and decisions.

Do not merge/deploy the main application configuration while the encoder service is absent. The current production version remains the WAV hotfix from PR #90. This increment is not a production launch claim.

### Isolated provider check

`services/encoder/wrangler.verification.jsonc` deploys the same encoder code to a separate private Worker and container, bound only to `sunstruck-synapse-media-preview`. After that service is active, `services/encoder/wrangler.probe.jsonc` deploys a private scheduled probe. Neither has a public URL, and neither has a database binding.

The probe creates one second of synthetic WAV audio, calls the encoder through its private service binding, reads back and hashes the actual stored MP3, verifies the fixed profile and original source preservation, and confirms that a wrong source checksum produces no derivative. It records a structured `sunsyn.encoder.verification` event and a private result under its explicit run ID. Conditional creation of the result marker admits one attempt per run ID, so a failed run does not repeatedly consume encoding resources. To repeat it, choose a new `VERIFICATION_RUN`, temporarily enable its cron, deploy, inspect the result and disable the cron again. No production recordings are used or copied.

The encoder Workers Builds triggers are separate from the live application trigger. During implementation they watch `agent/guided-publishing-workspace`; switch them to `main` when the maintainer merges this PR. Deploying the encoder alone does not activate the new artist or publishing UI.

## Authority and acceptance

This work continues under the recorded maintainer SOLO exception in `curation-implementation-progress.md`. No Village agents, ceremonies, independent grades or independent acceptance are claimed. PR #91 opened as Draft and the maintainer subsequently requested Ready and resolution of its open comments. The maintainer will perform UAT; smoke checks and required PR automation remain the implementation verification boundary. Existing human publication decisions, authentication, private originals, declaration lineage and production content remain intact.
