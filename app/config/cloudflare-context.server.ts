import { createContext } from "react-router";

import type { Database } from "~/db/client.server";

import type { DatabaseEnv } from "./env.server";

export interface CloudflareContextValue {
  db: Database;
  env: DatabaseEnv;
  ctx: ExecutionContext;
}

export const cloudflareContext = createContext<CloudflareContextValue>();
