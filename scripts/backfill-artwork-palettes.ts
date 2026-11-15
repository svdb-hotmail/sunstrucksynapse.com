import {
  createStaticArtworkPaletteProcessor,
  decodeStaticArtwork,
} from "../app/services/artwork-palette-static-backfill.server";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../app/db/schema";
import { createArtworkPalettesRepository } from "../app/repositories/artwork-palettes.server";
import { createCurationOutboxRepository } from "../app/repositories/curation-outbox.server";
import { reviewedIdentitySlugs } from "../app/design-system/reviewed-identities";
import {
  backfillArtworkPalettes,
  sanitizedDatabaseTarget,
  validatePaletteBackfillOptions,
  type PaletteBackfillOptions,
} from "../app/services/artwork-palette-backfill.server";

const args = process.argv.slice(2);
const known = new Set([
  "--environment",
  "--limit",
  "--after",
  "--write",
  "--confirm-production-writes",
  "--requeue-failed",
]);
for (let i = 0; i < args.length; i++) {
  if (!known.has(args[i])) throw new Error("Unknown backfill argument.");
  if (["--environment", "--limit", "--after"].includes(args[i])) i++;
}
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i < 0 ? undefined : args[i + 1];
};
const options: PaletteBackfillOptions = {
  environment: value("--environment") as PaletteBackfillOptions["environment"],
  limit: Number(value("--limit")),
  after: value("--after"),
  write: args.includes("--write"),
  confirmProductionWrites: args.includes("--confirm-production-writes"),
  requeueFailed: args.includes("--requeue-failed"),
};
validatePaletteBackfillOptions(options);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required.");
console.log(
  JSON.stringify({
    target: sanitizedDatabaseTarget(databaseUrl),
    environment: options.environment,
    mode: options.write ? "write" : "dry-run",
  }),
);
const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });
const repository = createArtworkPalettesRepository(db);
const outbox = createCurationOutboxRepository(db);

const processStatic = createStaticArtworkPaletteProcessor({
  palettes: repository,
  outbox,
  decode: decodeStaticArtwork,
  async claimExact(jobId, source) {
    const jobs = await db.execute<{
      leaseToken: string;
    }>(sql`update curation_outbox set status='processing', attempts=attempts+1, lease_token=gen_random_uuid(), lease_expires_at=now()+interval '90 seconds', updated_at=now(), error_code=null, completed_at=null
      where id=${jobId}::uuid and kind='artwork_palette_generate' and payload @> ${JSON.stringify(source)}::jsonb and attempts<10
        and ((status='pending' and available_at<=now()) or (status='processing' and lease_expires_at<=now()))
      returning lease_token as "leaseToken"`);
    return jobs[0]?.leaseToken ?? null;
  },
});

try {
  console.log(
    JSON.stringify(
      await backfillArtworkPalettes(
        repository,
        options,
        new Set(reviewedIdentitySlugs),
        processStatic,
      ),
    ),
  );
} catch {
  console.error("Artwork palette backfill failed; no credentials or source paths are reported.");
  process.exitCode = 1;
} finally {
  await client.end();
}
