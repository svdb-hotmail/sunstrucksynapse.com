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

The seed is deterministic, synthetic, and idempotent. It includes catalogue credits and ordering, private-master and publishable-derivative metadata, a collection, an accepted submission, and two retained versions of each governance record. Running it twice creates no duplicate logical records.

The real migrate and seed entry points load an optional local `.env`, synchronously validate `DATABASE_URL`, and fail with a sanitized message before opening a connection when it is absent or malformed. Both adapters call the same injected, typed seed core in `scripts/seed-data.ts`.

## In-process validation

Run the complete ephemeral validation harness without Docker, WSL, PostgreSQL tools, `DATABASE_URL`, or any network database:

```bash
npm run db:validate:local
```

The harness uses Drizzle's official PGlite adapter to apply the committed migration to a fresh in-memory database. It inspects tables, indexes, foreign keys, checks, and custom triggers; runs the shared seed twice and compares all table counts; reads catalogue, editorial, submission, and governance relations in order; verifies `updated_at` advances; rejects invalid uniqueness, collection target, release credit, and version-supersession writes; then repeats migration and seed in a second fresh database.

PGlite executes PostgreSQL semantics in-process and reports its own `select version()` value. It is not a network connection and is not evidence that a particular PostgreSQL server or Neon version was tested. Live Neon compatibility remains a separate isolated-environment check.

## Database-managed invariants

The initial migration installs `set_updated_at()` triggers on every primary table that uses the shared timestamp columns, so direct SQL updates advance `updated_at` without application cooperation.

Rights declarations, creative-process disclosures, and provenance records use a shared supersession trigger plus unique predecessor indexes. The forward migration first rejects any pre-existing invalid history. Version 1 cannot have a predecessor; every later version must point to the immediately preceding version for the exact same submission, release, or track; parent/version/predecessor fields are immutable; and one predecessor cannot branch into multiple successors. Draft records can advance through their lifecycle, but attested, finalized, or superseded records cannot be changed, and version records cannot be deleted. Revisions after finalization remain append-only.

Wrangler 4.123.0's pinned `config-schema.json` supports `secrets.required`, so `wrangler.jsonc` declares `DATABASE_URL` there. This declaration improves generated typing and local warnings but does not set a value; use `npx wrangler secret put DATABASE_URL` for deployed environments.

## Rollback and recovery

Prefer a forward corrective migration for shared or persistent databases. For a disposable Neon development branch, reset or recreate that branch in Neon and reapply migrations. For a disposable local database, verify the target name and host, then drop and recreate that database with PostgreSQL administration tools before reapplying and reseeding.

Never run destructive reset steps against an unidentified target. There is intentionally no broad drop script. For any non-disposable database, take and verify a backup first, follow the provider recovery procedure, and rehearse restoration before depending on it.
