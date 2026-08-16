import { createContext } from "react-router";

import type { Database } from "~/db/client.server";
import type { CatalogueRepository } from "~/repositories/catalogue.server";
import type { CuratorRepository } from "~/repositories/curator.server";
import type { SubmissionRepository } from "~/repositories/submissions.server";
import type { CuratorIdentity } from "~/types/curator";

import type { WorkerEnv } from "./env.server";

export interface CloudflareContextValue {
  db?: Database;
  catalogueRepository: CatalogueRepository;
  curatorRepository?: CuratorRepository;
  submissionRepository?: SubmissionRepository;
  env?: WorkerEnv;
  identity?: CuratorIdentity;
  ctx: ExecutionContext;
}

export const cloudflareContext = createContext<CloudflareContextValue>();
