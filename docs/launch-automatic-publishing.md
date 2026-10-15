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
- Strict TypeScript, touched-file ESLint, the production application build, Storybook build and encoder Worker bundle pass. Final PR evidence records the exact checked revision.
- Local Chromium exits with signal 11; the Playwright browser download is truncated by this environment. No local browser pass is claimed. Remote Storybook is used for visual review where available; production E2E remains a separate deployment check.
- Read-only Cloudflare checks confirmed the media bucket has managed public access disabled and no custom public domains. Its existing signed application delivery remains the public boundary.

## Deployment blocker and exact sequence

The connected Cloudflare account is `f9db1511596713616ac19b4f7538d337`. The Containers API currently rejects access with: “Deploying containers requires the Workers Paid plan.” No plan or billing setting was changed.

1. The account owner enables Workers Paid at [the account's Workers plans page](https://dash.cloudflare.com/f9db1511596713616ac19b4f7538d337/workers/plans).
2. Deploy the private service first: `npx wrangler deploy --config services/encoder/wrangler.jsonc`, from a Cloudflare-authenticated environment with Docker available. The service name must be `sunstruck-synapse-encoder`; it has no public workers.dev or preview URL.
3. Verify real R2 source → container → checksum-sealed private derivative using synthetic media on isolated database/bucket bindings. This provider integration is not replaced by unit tests or a Storybook fixture. Never point preview code at the production database or private source media by default.
4. Run full PR CI through the existing maintainer Ready-for-Review gate. Do not bypass its checks. Apply committed migration 0013 with a direct connection to the explicitly identified production database, using the normal Drizzle migration command. Do not reset, seed or clean production.
5. Deploy the application with the `AUDIO_ENCODER` service binding included in `wrangler.jsonc`, after the encoder exists. Verify the deployed revision, invitation upload, real human review/acceptance, private preparation, explicit publication, public ranges, album playback and mobile/theme behavior. The maintainer performs the production journey with their own material and decisions.

Do not merge/deploy the main application configuration while the encoder service is absent. The current production version remains the WAV hotfix from PR #90. This increment is not a production launch claim.

## Authority and acceptance

This work continues under the recorded maintainer SOLO exception in `curation-implementation-progress.md`. No Village agents, ceremonies, independent grades or independent acceptance are claimed. PRs open as Draft. Existing human publication decisions, authentication, private originals, declaration lineage and production content remain intact.
