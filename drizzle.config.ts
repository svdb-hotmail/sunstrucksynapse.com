import { defineConfig } from "drizzle-kit";

import { validateDatabaseEnv } from "./app/config/env.server";

const env = validateDatabaseEnv(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./app/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
