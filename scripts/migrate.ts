import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { validateDatabaseEnv } from "../app/config/env.server";

const env = validateDatabaseEnv(process.env);
const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Committed database migrations are applied.");
} finally {
  await client.end();
}
