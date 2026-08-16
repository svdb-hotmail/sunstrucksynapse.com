import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext } from "../app/config/cloudflare-context.server";
import { validateDatabaseEnv } from "../app/config/env.server";
import { createDatabase } from "../app/db/client.server";
import { createE2eCatalogueRepository } from "../app/repositories/catalogue-fixture.server";
import { createCatalogueRepository } from "../app/repositories/catalogue.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    if (import.meta.env.MODE === "test") {
      context.set(cloudflareContext, {
        catalogueRepository: createE2eCatalogueRepository(),
        ctx,
      });
      return requestHandler(request, context);
    }

    let validatedEnv;
    try {
      validatedEnv = validateDatabaseEnv(env);
    } catch {
      return new Response("Server configuration error.", {
        status: 500,
        statusText: "Internal Server Error",
      });
    }

    const db = createDatabase(validatedEnv);
    context.set(cloudflareContext, {
      db,
      catalogueRepository: createCatalogueRepository(db),
      env: validatedEnv,
      ctx,
    });

    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
