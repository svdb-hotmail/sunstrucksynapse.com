# Durable artwork palette rollout

Palette generation samples the final ready publishable artwork, never an upload preview or a page request. Version 1 accepts JPEG, PNG, WebP and AVIF. Existing SVG artwork remains usable artwork but palette generation records `UNSUPPORTED_MIME_TYPE` in the background worker or `UNSUPPORTED_SOURCE` in the local static backfill and the UI keeps its reviewed identity or skin fallback. Generated colors and human overrides occupy separate tables; generation never updates an override. Public projection checks source provenance and contrast before exposing seven hexadecimal semantic colors.

No production migration, deployment, producer activation or backfill was executed while implementing this change. Cloudflare's current dashboard trigger still uses `npm run build` and `npx wrangler deploy`; the account-side settings have **not** been changed. Neither `npm run build` nor CI invokes this rollout or a write backfill.

Public catalogue reads tolerate an application deploy arriving before migration `0017`: only PostgreSQL missing-relation errors naming `artwork_palette_generations` or `artwork_palette_overrides` fall back to reviewed identity/skin colors. Other database failures still surface. Requests perform no migration and retry palette reads normally after migration, so this compatibility fallback does not replace the migration-first deployment wrapper below.

## Review the target first

Use Node 22.22+, installed dependencies, Python 3 and FFmpeg for local static generation. Supply `DATABASE_URL` through the approved secret mechanism; never paste it into reports. The commands print only database hostname/database, selected environment, config paths and bucket names.

Production planning (replace the hostname):

```bash
npm run deploy:palettes -- --environment production --expected-database-host REVIEWED_DATABASE_HOST --limit 100 --plan
```

Development must use separately provisioned, reviewed isolated Worker/service/bucket configurations and a development database. The wrapper does not invent an environment or map production resources to development:

```bash
npm run deploy:palettes -- --environment development --expected-database-host REVIEWED_DEV_DATABASE_HOST --app-config /absolute/path/to/reviewed-app-config.jsonc --encoder-config /absolute/path/to/reviewed-encoder-config.jsonc --limit 100 --plan
```

Check that both selected configs and the app's encoder service binding refer to the intended resources. The deployed app Worker's existing `DATABASE_URL` secret must match the **exact database target** being migrated and producer-enabled, including database name. The wrapper cannot read deployed Worker secrets; the operator must confirm this prerequisite. It never overwrites that secret. The reviewed app config is passed to Vite through `SUNSYN_WRANGLER_CONFIG` (site-preview keeps its own config). The wrapper deploys Vite's generated `build/server/wrangler.json` after a successful build, including the built Worker entry and client assets. Review the planned target before dropping `--plan`.

## Ordered deployment

After the deployment is authorized, run the same reviewed command without `--plan`. It stops on the first failed step and performs:

1. `npm run db:migrate` applies all committed migrations, including `0017` with a disabled producer. It does not queue existing assets.
2. `npx wrangler deploy --config SELECTED_ENCODER_CONFIG` deploys the private encoder first.
3. `npm run build` and the app deployment publish the consumer.
4. Only after both deployments succeed, `UPDATE artwork_palette_settings SET enable_new_artwork=true WHERE singleton=true` enables jobs for future final asset inserts/replacements.
5. `artwork:palettes:backfill --environment TARGET --limit 100` reports existing artwork metadata in **dry-run** mode, with zero asset reads and zero writes.

For Cloudflare's production dashboard build trigger, replace the commands with these exact values, substituting the reviewed database hostname:

- **Build command:** `npm ci --no-audit --no-fund`
- **Deploy command:** `npm run deploy:palettes -- --environment production --expected-database-host REVIEWED_DATABASE_HOST --limit 100`

The trigger needs its existing Cloudflare deploy credentials, access to the same intended `DATABASE_URL`, and container deployment capability. Changing these account-side fields is an operator prerequisite. The wrapper builds the app itself after migrating and deploying the encoder. Do not retain an additional automatic `npx wrangler deploy` after it.

If an activation or dry-run step fails after deployment, inspect the completed steps before retrying. The migration is additive and idempotent; producer activation does not backfill existing rows. A successful deploy dry-run never means existing palettes were generated.

## Review the dry-run, then write a bounded backfill

Independent metadata-only commands:

```bash
npm run artwork:palettes:backfill -- --environment development --limit 100
npm run artwork:palettes:backfill -- --environment production --limit 100
```

Reports distinguish scanned, eligible, current, overrides, reviewed identities, queued, processed, unchanged and failed assets. One asset linked to multiple catalogue records is processed once. `nextCursor` is the last scanned UUID; pass it to `--after` to resume. A shorter-than-limit batch means the end was reached. `unchanged` means enqueue made no change (for example an existing job or an override/current generation appearing concurrently), and does not claim successful generation.

Review the database target, counts, supported MIME types and failures. **Existing production artwork writes require human approval of this concrete dry-run before running the next command.** The CLI additionally enforces the explicit production flag:

```bash
npm run artwork:palettes:backfill -- --environment production --limit 100 --write --confirm-production-writes
npm run artwork:palettes:backfill -- --environment production --limit 100 --after LAST_REVIEWED_UUID --write --confirm-production-writes
```

Development write batches use `--environment development --limit 100 --write`. Use `--requeue-failed` only for an intentionally reviewed retry after correcting the source/decoder problem. R2 assets are queued for the private background encoder; `queued` is not `processed`. Static assets are confined by real path to this checkout's `public/` directory and checked against database SHA-256/size before using the same versioned local Python/FFmpeg extractor. Static writes acquire the exact outbox job lease and use the same source/lease compare-and-set persistence as background generation. Each asset failure is reported and processing continues. No arbitrary URL is fetched.

Current palettes, asset overrides and linked manually reviewed slug identities are skipped. Per-asset failures do not abort a batch; a failure is not a generated palette. Retry/rerun safely; source identity and job keys prevent duplicate work and stale writes. Never run a write backfill from the build command or CI.

## Verification

Use the approved database console, with no credentials in captured output:

```sql
SELECT singleton, enable_new_artwork FROM artwork_palette_settings;
SELECT status, count(*) FROM artwork_palette_generations GROUP BY status ORDER BY status;
SELECT status, error_code, count(*) FROM curation_outbox
WHERE kind='artwork_palette_generate' GROUP BY status,error_code ORDER BY status,error_code;
SELECT g.artwork_asset_id, g.algorithm_version, g.status,
       g.source_object_key=a.object_key AS key_matches,
       g.source_checksum_sha256=a.checksum_sha256 AS checksum_matches,
       g.source_mime_type=a.mime_type AS mime_matches,
       g.source_byte_size=a.byte_size AS size_matches,
       g.source_storage_provider=a.storage_provider::text AS provider_matches
FROM artwork_palette_generations g JOIN artwork_assets a ON a.id=g.artwork_asset_id;
SELECT artwork_asset_id, version, updated_at FROM artwork_palette_overrides ORDER BY artwork_asset_id;
```

A newly finalized supported artwork should acquire a pending generation/job after producer activation, then become ready after the scheduled processor. Verify that the public featured/artist/release payload uses that actual selected asset's validated palette and that a source replacement cannot expose the prior generation. Check light/dark text and white accent-button labels; verify existing reviewed slug identities still win over generated palettes and explicit asset overrides win over both. Check email, staging cleanup and audio preparation continue; audio preparation precedes the single palette worker claim. Missing encoder configuration leaves palette jobs pending without attempt consumption; a busy encoder defers without spending the terminal retry budget.

## Rollback

Disable new production first:

```sql
UPDATE artwork_palette_settings SET enable_new_artwork=false WHERE singleton=true;
```

Keep the additive tables and overrides. Deploy the previous compatible app/encoder versions if needed; do not delete assets, generated rows or override data as a rollback shortcut. If rolling back to an older generic outbox consumer that does not recognize palette jobs, stop its scheduled dispatcher or leave that consumer on the new admission-filtered version until rollback handling is reviewed. Paused palette jobs can resume after a corrected deployment. Public pages retain reviewed identity/skin fallback when no validated current generation is available.
