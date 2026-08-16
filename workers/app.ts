import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext } from "../app/config/cloudflare-context.server";
import { validateWorkerEnv } from "../app/config/env.server";
import { createDatabase } from "../app/db/client.server";
import { createE2eCatalogueRepository } from "../app/repositories/catalogue-fixture.server";
import { createCatalogueRepository } from "../app/repositories/catalogue.server";
import { createE2eCuratorRepository } from "../app/repositories/curator-fixture.server";
import { createCuratorRepository } from "../app/repositories/curator.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);
const e2eCuratorRepository = createE2eCuratorRepository();

export default {
  fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    if (import.meta.env.MODE === "test") {
      context.set(cloudflareContext, {
        catalogueRepository: createE2eCatalogueRepository(),
        curatorRepository: e2eCuratorRepository,
        ctx,
      });
      return requestHandler(request, context);
    }

    let validatedEnv;
    try {
      validatedEnv = validateWorkerEnv(env);
    } catch {
      return new Response("Server configuration error.", {
        status: 500,
        statusText: "Internal Server Error",
      });
    }

    const db = createDatabase(validatedEnv);
    context.set(cloudflareContext, {
      db,
      catalogueRepository: createCatalogueRepository(db, {
        signingSecret: validatedEnv.MEDIA_DELIVERY_SIGNING_SECRET,
      }),
      curatorRepository: createCuratorRepository(db),
      env: validatedEnv,
      ctx,
    });

    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
