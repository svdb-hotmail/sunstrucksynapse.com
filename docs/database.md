# Database foundation

Sunstruck Synapse Radio uses PostgreSQL with reviewed, code-first Drizzle migrations. Production is intended for Neon. The Worker creates a request-scoped Drizzle client through `@neondatabase/serverless` Neon HTTP; database connections and credentials never enter browser code.

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

Wrangler 4.123.0's pinned `config-schema.json` supports `secrets.required`, so `wrangler.jsonc` declares `DATABASE_URL` there. This declaration improves generated typing and local warnings but does not set a value; use `npx wrangler secret put DATABASE_URL` for deployed environments.

## Rollback and recovery

Prefer a forward corrective migration for shared or persistent databases. For a disposable Neon development branch, reset or recreate that branch in Neon and reapply migrations. For a disposable local database, verify the target name and host, then drop and recreate that database with PostgreSQL administration tools before reapplying and reseeding.

Never run destructive reset steps against an unidentified target. There is intentionally no broad drop script. For any non-disposable database, take and verify a backup first, follow the provider recovery procedure, and rehearse restoration before depending on it.
