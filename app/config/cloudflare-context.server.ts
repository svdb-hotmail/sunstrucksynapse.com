import { createContext } from "react-router";

import type { Database } from "~/db/client.server";
import type { CatalogueRepository } from "~/repositories/catalogue.server";

import type { DatabaseEnv } from "./env.server";

export interface CloudflareContextValue {
  db?: Database;
  catalogueRepository: CatalogueRepository;
  env?: DatabaseEnv;
  ctx: ExecutionContext;
}

export const cloudflareContext = createContext<CloudflareContextValue>();
