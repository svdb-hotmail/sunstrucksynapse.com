# Database foundation

SunSyn Radio uses PostgreSQL with reviewed, code-first Drizzle migrations. Production is intended for Neon. The Worker creates a request-scoped Drizzle client through `@neondatabase/serverless` Neon HTTP; database connections and credentials never enter browser code.

The pinned data packages are `@neondatabase/serverless` 1.1.0, `drizzle-orm` 0.45.2, `drizzle-kit` 0.31.10, `postgres` 3.4.9 (Node-only seed transport), and `@electric-sql/pglite` 0.5.5 (local in-process validation only). The authoritative schema export is `app/db/schema/index.ts`.

## Environment separation

Every development, preview, and production environment must have a different database. Prefer an isolated Neon development branch. PostgreSQL 18 running locally is also suitable for migration and seed work.

Copy the clearly fake `.env.example` to an ignored `.env`, then replace its value:

```text
DATABASE_URL=postgresql://user:password@localhost:5432/sunstruck_synapse_dev
```

`DATABASE_URL` is required and synchronously validated as a non-empty PostgreSQL URL. Errors never include the credential. For deployed Workers, configure the secret without committing its value:

```bash
npx wrangler secret put DATABASE_URL
```

Do not expose `DATABASE_URL` through Vite client variables, route payloads, logs, or browser code.

## Local PostgreSQL

Create a dedicated, disposable PostgreSQL database and user with normal database-owner migration privileges. Set `DATABASE_URL` in the current shell or an ignored `.env`. Always identify the host, database, and environment before applying or resetting anything.

## Generate and review migrations

Change the code-first schema, then generate SQL:

```bash
npm run db:generate
npm run db:check
```

These commands are credential-free and do not connect to a database. Review the generated SQL, Drizzle journal, and snapshot together. Confirm every table, enum, constraint, foreign key, index, trigger, and deletion rule before committing. `drizzle-kit push` is not the normal workflow because it bypasses the reviewed, versioned SQL history required for catalogue, editorial, rights, and provenance data.

## Apply and seed

Apply committed migrations only to an explicitly identified non-production target:

```bash
npm run db:migrate
npm run db:seed
```

The seed is deterministic and idempotent. It includes the five rights-cleared Phase 1 listener tracks with track-specific artwork and publishable media, a private master that public queries must exclude, archived synthetic invariant fixtures, catalogue credits and ordering, a collection, accepted submissions, and retained governance history. Running it twice creates no duplicate logical records.

The real migrate and seed entry points load an optional local `.env`, synchronously validate `DATABASE_URL`, and fail with a sanitized message before opening a connection when it is absent or malformed. Both adapters call the same injected, typed seed core in `scripts/seed-data.ts`.

## In-process validation

Run the complete ephemeral validation harness without Docker, WSL, PostgreSQL tools, `DATABASE_URL`, or any network database:

```bash
npm run db:validate:local
```

The harness uses Drizzle's official PGlite adapter to apply the committed migrations to a fresh in-memory database. It inspects tables, track-specific artwork relations, indexes, foreign keys, checks, and custom triggers; runs the shared seed twice and compares all table counts; reads catalogue, editorial, submission, and governance relations in order; verifies `updated_at` advances; rejects incomplete artwork dimensions, ambiguous submission outcomes, invalid uniqueness, collection targets, release credits, and version-supersession writes; then repeats migration and seed in a second fresh database.

PGlite executes PostgreSQL semantics in-process and reports its own `select version()` value. It is not a network connection and is not evidence that a particular PostgreSQL server or Neon version was tested. Live Neon compatibility remains a separate isolated-environment check.

## Database-managed invariants

The forward invariant migration installs `set_updated_at()` triggers on every primary table that uses the shared timestamp columns, so direct SQL updates advance `updated_at` without application cooperation.

Artwork dimensions must be absent as a pair or present as positive width and height. A submission may reference at most one resulting release or track, and any resulting target requires accepted status.

Release artist-credit updates and deletes lock their parent release rows before mutation. This serializes concurrent removals for each release before the deferred constraint trigger verifies that a surviving credit remains.

Rights declarations, creative-process disclosures, and provenance records use a shared lifecycle trigger plus unique predecessor indexes. The forward migration first rejects any pre-existing invalid history. Every version begins as a draft; version 1 has no predecessor, and every later draft points to the immediately preceding attested/finalized version for the exact same submission, release, or track. Creating a draft successor leaves its predecessor current. Attesting or finalizing that successor atomically marks the predecessor superseded. Direct or premature supersession, draft predecessors, gaps, branches, cross-parent links, identity changes, finalized-content changes, and deletion are rejected. Provenance steps, sources, and private evidence references can change only while their parent provenance record is draft. Revisions therefore follow one append-only lifecycle across all three governance record types.

Phase 3 adds invitation-backed submission records, submission activity history, private evidence upload sessions, evidence-access grants, and pinned acceptance links to the exact reviewed rights, process, and provenance revisions. Invitation and evidence-upload rows use the shared `updated_at` trigger pattern; evidence-access rows are intentionally append-only audit records.

## Curation outbox substrate

`curation_outbox` stores generic event kinds and JSON object payloads; it does not encode an email-provider contract. Payloads are limited to 64 KiB. Application validation measures compact JSON for an early rejection, while the PostgreSQL `jsonb::text` byte check is authoritative because its canonical representation may be larger.

Each nonblank idempotency key is unique. The first insert is preserved and later inserts with the same key return no new identifier without replacing its kind, payload, or schedule. `buildCurationOutboxInsert()` exposes the parameterized insert so a future domain mutation can embed it in the same SQL CTE and gain statement-level rollback.

Claims use database time and select due pending rows or expired processing leases. A claim:

- accepts a bounded batch of 1–100 rows;
- creates a distinct lease for each row, lasting 1–900 seconds with a 60-second default;
- increments the attempt count, up to ten attempts;
- requires the exact, unexpired lease token for acknowledgement or retry.

A successful acknowledgement returns `true`, moves the row to `succeeded`, and clears its lease and error. A repeated acknowledgement returns `false` and makes no change because the completed row intentionally forgets the lease. Retrying records a sanitized error code and defers availability by at most one day. A failure on the tenth claimed attempt becomes terminal immediately. If a worker abandons an expired tenth-attempt lease, the next claim sweep marks it failed with `RETRY_EXHAUSTED` and clears the lease without returning it for execution.

Database checks preserve status, lease, attempt, error, completion, and payload invariants. The shared timestamp trigger advances `updated_at` on direct updates. A separate trigger rejects every update or delete of a succeeded row.

Execution is at least once, not exactly once. A provider may complete an external action before the worker loses its acknowledgement, so a later retry can duplicate that action; downstream provider operations still need their own idempotency strategy.

The scheduled Worker now dispatches `submission_decision_email` jobs through the existing
transactional-email adapter. Unknown job kinds and malformed payloads are retained for bounded
retry rather than acknowledged. The provider call remains at-least-once; true multi-connection
`SKIP LOCKED` behavior and live Neon compatibility remain separate integration evidence.

## Curation listening workflow

Migration 0010 separates three contracts that must not be conflated:

- `submission_audio_upload_sessions` authorizes short-lived writes to staging object keys;
- `submission_review_audio` is immutable, versioned metadata for checksum-verified objects under
  a separate final key; and
- `submission_review_audio_selections` points at the one current listening copy while retaining
  every older version.

Presigned PUTs sign the declared content type and upload metadata. Finalization does not trust the
staging declaration: it streams and hashes the stored object, checks its byte count, writes it to a
new immutable key, verifies the sealed object, and only then selects it in the database. Cleanup
deletes incomplete staging keys; finalized objects are never part of automatic cleanup. Review
audio has no public route. Its only playback route is protected by Cloudflare Access and supports
single byte-range requests with private, no-store responses.

`curation_reviews` records four separate 1–5 observations and one explicit A/B/C editorial grade.
No numeric aggregate or acceptance threshold exists. A and B accept; A also records feature
distinction in activity metadata. C declines. A/B atomically pins the exact declaration and audio
versions, creates a draft artist/release/track set with collision-resistant submission-derived
slugs, records the decision, and enqueues the notification. It does not schedule, publish, or add
content to homepage collections. Previously accepted or rejected submissions remain valid without
invented historical reviews.

Wrangler 4.123.0's pinned `config-schema.json` supports `secrets.required`, so `wrangler.jsonc` declares `DATABASE_URL` there. This declaration improves generated typing and local warnings but does not set a value; use `npx wrangler secret put DATABASE_URL` for deployed environments.

## Rollback and recovery

Prefer a forward corrective migration for shared or persistent databases. For a disposable Neon development branch, reset or recreate that branch in Neon and reapply migrations. For a disposable local database, verify the target name and host, then drop and recreate that database with PostgreSQL administration tools before reapplying and reseeding.

Never run destructive reset steps against an unidentified target. There is intentionally no broad drop script. For any non-disposable database, take and verify a backup first, follow the provider recovery procedure, and rehearse restoration before depending on it.
