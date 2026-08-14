# Database foundation

Sunstruck Synapse Radio uses PostgreSQL 18.6 with reviewed, code-first Drizzle migrations. Production is intended for Neon. The Worker creates a request-scoped Drizzle client through `@neondatabase/serverless` Neon HTTP; database connections and credentials never enter browser code.

The pinned data packages are `@neondatabase/serverless` 1.1.0, `drizzle-orm` 0.45.2, `drizzle-kit` 0.31.10, and `postgres` 3.4.9 (Node-only seed transport). The authoritative schema export is `app/db/schema/index.ts`.

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

Create a dedicated, disposable PostgreSQL 18.6 database and user with normal database-owner migration privileges. Set `DATABASE_URL` in the current shell or an ignored `.env`. Always identify the host, database, and environment before applying or resetting anything.

## Generate and review migrations

Change the code-first schema, then generate SQL:

```bash
npm run db:generate
npm run db:check
```

Review the generated SQL, Drizzle journal, and snapshot together. Confirm every table, enum, constraint, foreign key, index, and deletion rule before committing. `drizzle-kit push` is not the normal workflow because it bypasses the reviewed, versioned SQL history required for catalogue, editorial, rights, and provenance data.

## Apply and seed

Apply committed migrations only to an explicitly identified non-production target:

```bash
npm run db:migrate
npm run db:seed
```

The seed is deterministic, synthetic, and idempotent. It includes catalogue credits and ordering, private-master and publishable-derivative metadata, a collection, an accepted submission, and two retained versions of each governance record. Running it twice creates no duplicate logical records.

## Rollback and recovery

Prefer a forward corrective migration for shared or persistent databases. For a disposable Neon development branch, reset or recreate that branch in Neon and reapply migrations. For a disposable local database, verify the target name and host, then drop and recreate that database with PostgreSQL administration tools before reapplying and reseeding.

Never run destructive reset steps against an unidentified target. There is intentionally no broad drop script. For any non-disposable database, take and verify a backup first, follow the provider recovery procedure, and rehearse restoration before depending on it.
