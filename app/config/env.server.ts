export type DatabaseEnv = Readonly<{
  DATABASE_URL: string;
}>;

export interface MediaBucket {
  put(
    key: string,
    value: ReadableStream<Uint8Array>,
    options: {
      httpMetadata: { contentType: string };
      customMetadata: Record<string, string>;
      sha256: string;
    },
  ): Promise<{ size: number }>;
  head(key: string): Promise<{ size: number; customMetadata?: Record<string, string> } | null>;
  get(
    key: string,
    options: { range: Headers },
  ): Promise<{
    body: ReadableStream;
    size: number;
    range?: { offset: number; length: number };
    httpEtag: string;
    writeHttpMetadata(headers: Headers): void;
  } | null>;
  delete(key: string): Promise<void>;
}

export type WorkerEnv = DatabaseEnv &
  Readonly<{
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD: string;
    CURATOR_EMAILS: string;
    MEDIA_DELIVERY_SIGNING_SECRET: string;
    MEDIA_BUCKET: MediaBucket;
    POSTMARK_SERVER_TOKEN?: string;
    TRANSACTIONAL_EMAIL_FROM?: string;
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

function requiredString(source: object, name: string): string {
  const value = Reflect.get(source, name);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

export function validateWorkerEnv(source: object): WorkerEnv {
  const database = validateDatabaseEnv(source);
  const teamDomain = requiredString(source, "ACCESS_TEAM_DOMAIN").replace(/\/+$/, "");
  const mediaBucket = Reflect.get(source, "MEDIA_BUCKET");
  if (!teamDomain.startsWith("https://") || !teamDomain.endsWith(".cloudflareaccess.com")) {
    throw new Error("ACCESS_TEAM_DOMAIN must be an HTTPS cloudflareaccess.com team domain.");
  }
  if (
    typeof mediaBucket !== "object" ||
    mediaBucket === null ||
    typeof Reflect.get(mediaBucket, "get") !== "function"
  ) {
    throw new Error("MEDIA_BUCKET R2 binding is required.");
  }

  return Object.freeze({
    ...database,
    ACCESS_TEAM_DOMAIN: teamDomain,
    ACCESS_AUD: requiredString(source, "ACCESS_AUD"),
    CURATOR_EMAILS: requiredString(source, "CURATOR_EMAILS"),
    MEDIA_DELIVERY_SIGNING_SECRET: requiredString(source, "MEDIA_DELIVERY_SIGNING_SECRET"),
    MEDIA_BUCKET: mediaBucket as MediaBucket,
    ...(typeof Reflect.get(source, "POSTMARK_SERVER_TOKEN") === "string"
      ? { POSTMARK_SERVER_TOKEN: String(Reflect.get(source, "POSTMARK_SERVER_TOKEN")).trim() }
      : {}),
    ...(typeof Reflect.get(source, "TRANSACTIONAL_EMAIL_FROM") === "string"
      ? { TRANSACTIONAL_EMAIL_FROM: String(Reflect.get(source, "TRANSACTIONAL_EMAIL_FROM")).trim() }
      : {}),
  });
}
