import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { it, expect } from "vitest";
import * as schema from "../../app/db/schema";
import type { Database } from "../../app/db/client.server";
import { exerciseReleasePipeline } from "../helpers/exercise-release-pipeline";
it("carries real intake through album review, fenced preparation and atomic publication", async () => {
  const client = new PGlite();
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    const adapter = Object.create(db);
    adapter.batch = async (queries: Promise<unknown>[]) => {
      await client.exec("begin");
      try {
        const results = [];
        for (const query of queries) results.push(await query);
        await client.exec("commit");
        return results;
      } catch (error) {
        await client.exec("rollback");
        throw error;
      }
    };
    expect(await exerciseReleasePipeline(adapter as Database)).toMatchObject({
      tracks: 2,
      publishAuditCount: 4,
    });
  } finally {
    await client.close();
  }
}, 30000);
