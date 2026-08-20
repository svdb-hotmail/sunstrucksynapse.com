# Operations and recovery runbook

## Signals and alerting

Cloudflare Workers observability is enabled with source maps. Alerts should distinguish:

- **platform failure:** elevated Worker 5xx, database connection failures, R2 binding failures, or
  scheduled-handler failures across multiple assets;
- **individual media failure:** repeated `playback_error` events for one track while other tracks
  start successfully;
- **listener/network failure:** isolated errors without corresponding platform error rates.

Before beta, configure provider alerts for Worker 5xx rate, Worker latency, scheduled trigger
failure, and database connection saturation. Do not include signed URLs, tokens, contact data, or
evidence keys in alert payloads.

## Playback verification

From the production-like Worker domain:

1. Open one audio and one video track and capture `Server-Timing` plus browser resource timing.
2. Confirm at least 98 of 100 explicit play attempts produce `playback_started`.
3. Confirm median request-to-start is below 1.5 seconds on the agreed broadband profile.
4. Request `Range: bytes=0-1023` from a fresh signed URL; expect `206`, a valid
   `Content-Range`, and exactly 1,024 bytes.
5. Pause, seek, resume, interrupt the network, and retry.
6. Wait beyond signed-URL expiry; expect rejection, then use Retry to mint a fresh URL.
7. Record environment, browser, network profile, sample size, median, p95, and failure count.

Repository E2E proves graceful unavailable-media and retry behavior. It does not prove production
R2 latency, cache behavior, or the release targets.

## Database backup and restoration

Neon point-in-time restore or a protected database backup is the complete recovery source. The
catalogue JSON export is a reviewable public-metadata supplement, not a substitute for the database.

1. Create a protected Neon restore point or branch.
2. Run `npm run catalogue:export -- ./catalogue-export-YYYYMMDD.json`; store the result in the
   approved private backup location, never Git.
3. Create an isolated restore database from the backup/restore point.
4. Set `DATABASE_URL` only in the operator environment.
5. Run `npm run db:migrate`, `npm run db:validate:local`, and `npm run catalogue:audit`.
6. Deploy a preview Worker against the restored database and preview R2 binding.
7. Verify catalogue ordering, one audio and one video range request, private evidence isolation,
   curator authentication, and publication audit history.
8. Record restore point, operator, elapsed time, row counts, checksums, and outcome. Destroy the
   isolated database after approval.

The local PGlite quality gate continuously proves clean migration and seed reconstruction. A real
provider backup restore remains a pre-beta operator gate.

## Incident and rollback

1. Declare scope and stop further publication. Archive affected entities through the curator
   lifecycle rather than deleting records.
2. If private data may be exposed, revoke grants and Access sessions, rotate affected secrets, and
   preserve audit evidence.
3. Roll back the Worker to the last known-good deployment. Never reverse an applied migration by
   editing migration history.
4. For data corruption, restore into an isolated database first, validate it, then switch the
   Worker binding during an announced maintenance window.
5. Verify public rejection of unpublished content, media range delivery, Access enforcement,
   submission isolation, and scheduled publication.
6. Document timeline, impact, recovery point, data loss window, and follow-up owner.
