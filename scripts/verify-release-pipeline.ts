import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDatabase } from "../app/db/client.server";
import { exerciseReleasePipeline } from "../tests/helpers/exercise-release-pipeline";

// An explicit, isolated verification database is mandatory. Never infer a
// production target from a default project, branch or environment variable.
const connection = (await readFile(process.argv[2], "utf8")).trim();
const target = new URL(connection);
assert.equal(target.pathname, "/release_pipeline_verification_20261015");
assert(!target.hostname.includes("-pooler"));
const direct = postgres(connection, { max: 1 });
try {
  assert.equal(
    (await direct`select current_database() as name`)[0].name,
    "release_pipeline_verification_20261015",
  );
  await migrate(drizzle(direct), { migrationsFolder: "./drizzle" });
  const db = createDatabase({ DATABASE_URL: connection });
  const migrations = await db.execute(
    sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
  );
  assert.equal(migrations.rows[0].count, 14);
  const result = await exerciseReleasePipeline(db);
  console.log(JSON.stringify({ database: target.pathname.slice(1), migrations: 14, ...result }));
} finally {
  await direct.end();
}
