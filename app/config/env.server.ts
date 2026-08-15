export type DatabaseEnv = Readonly<{
  DATABASE_URL: string;
}>;

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export function validateDatabaseEnv(source: object): DatabaseEnv {
  const databaseUrl = Reflect.get(source, "DATABASE_URL");

  if (typeof databaseUrl !== "string" || databaseUrl.trim().length === 0) {
    throw new Error("DATABASE_URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol) || parsed.hostname.length === 0) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  return Object.freeze({ DATABASE_URL: databaseUrl });
}
