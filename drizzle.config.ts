import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./app/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
