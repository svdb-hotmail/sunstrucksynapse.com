import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import type { DatabaseEnv } from "~/config/env.server";

import * as schema from "./schema";

export function createDatabase(env: DatabaseEnv) {
  return drizzle(neon(env.DATABASE_URL), { schema });
}

export type Database = ReturnType<typeof createDatabase>;
