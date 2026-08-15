import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { validateDatabaseEnv } from "../app/config/env.server";
import * as schema from "../app/db/schema";
import { seedDatabase } from "./seed-data";

const env = validateDatabaseEnv(process.env);
const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

try {
  await seedDatabase(db);
  console.log("Database seed is present.");
} finally {
  await client.end();
}
