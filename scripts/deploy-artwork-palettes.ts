import { spawn } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { deployArtworkPalettes } from "../app/services/artwork-palette-deployment.server";
import { sanitizedDatabaseTarget } from "../app/services/artwork-palette-backfill.server";

const args = process.argv.slice(2);
const values = new Set([
  "--environment",
  "--expected-database-host",
  "--app-config",
  "--encoder-config",
  "--limit",
]);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--plan") continue;
  if (!values.has(args[i]) || !args[i + 1] || args[i + 1].startsWith("--"))
    throw new Error("Invalid deployment argument.");
  i++;
}
const value = (flag: string) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const environment = value("--environment");
if (environment !== "development" && environment !== "production")
  throw new Error("Explicit --environment development|production required.");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required.");
const target = sanitizedDatabaseTarget(databaseUrl);
if (!value("--expected-database-host") || target.hostname !== value("--expected-database-host"))
  throw new Error("Database hostname does not match explicit --expected-database-host.");
if (environment === "development" && (!value("--app-config") || !value("--encoder-config")))
  throw new Error(
    "Development requires reviewed --app-config and --encoder-config paths for isolated resources.",
  );
const appConfig = await realpath(value("--app-config") ?? "wrangler.jsonc");
const encoderConfig = await realpath(
  value("--encoder-config") ?? "services/encoder/wrangler.jsonc",
);
const limit = Number(value("--limit") ?? "100");
if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
  throw new Error("Limit must be between 1 and 1000.");
const buckets = async (file: string) =>
  [
    ...(await readFile(file, "utf8")).matchAll(
      /"(?:bucket_name|preview_bucket_name)"\s*:\s*"([^"\n]+)"/g,
    ),
  ].map((match) => match[1]);
console.log(
  JSON.stringify({
    environment,
    target,
    appConfig,
    encoderConfig,
    appBuckets: await buckets(appConfig),
    encoderBuckets: await buckets(encoderConfig),
    plan: args.includes("--plan"),
    steps: [
      "migrate",
      "deploy private encoder",
      "build/deploy app",
      "enable new artwork producer",
      "metadata-only backfill dry-run",
    ],
  }),
);
function run(
  command: string,
  commandArgs: string[],
  cwd = process.cwd(),
  environmentOverrides: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env: { ...process.env, ...environmentOverrides },
      stdio: "inherit",
      shell: false,
    });
    child.once("error", () => reject(new Error("Deployment command could not start.")));
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Deployment command failed; subsequent steps were stopped.")),
    );
  });
}
if (!args.includes("--plan")) {
  try {
    await deployArtworkPalettes(
      { environment, limit },
      {
        migrate: () => run("npm", ["run", "db:migrate"]),
        deployEncoder: () =>
          run(
            "npx",
            ["wrangler", "deploy", "--config", encoderConfig],
            path.dirname(encoderConfig),
          ),
        buildApp: () =>
          run("npm", ["run", "build"], process.cwd(), { SUNSYN_WRANGLER_CONFIG: appConfig }),
        // Vite's generated config contains the built Worker entry and client asset binding.
        deployApp: () =>
          run("npx", [
            "wrangler",
            "deploy",
            "--config",
            path.resolve("build/server/wrangler.json"),
          ]),
        async enableProducer() {
          const client = postgres(databaseUrl, { max: 1 });
          try {
            await client`update artwork_palette_settings set enable_new_artwork=true where singleton=true`;
          } finally {
            await client.end();
          }
        },
        runMetadataDryRun: (arguments_) => run(process.execPath, [...arguments_]),
      },
    );
  } catch {
    console.error(
      "Palette deployment stopped. Inspect the completed step before retrying; no existing-artwork write backfill was invoked.",
    );
    process.exitCode = 1;
  }
}
