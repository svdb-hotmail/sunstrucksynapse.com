import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext } from "../app/config/cloudflare-context.server";
import { validateDatabaseEnv } from "../app/config/env.server";
import { createDatabase } from "../app/db/client.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  fetch(request, env, ctx) {
    let validatedEnv;
    try {
      validatedEnv = validateDatabaseEnv(env);
    } catch {
      return new Response("Server configuration error.", {
        status: 500,
        statusText: "Internal Server Error",
      });
    }

    const context = new RouterContextProvider();
    context.set(cloudflareContext, {
      db: createDatabase(validatedEnv),
      env: validatedEnv,
      ctx,
    });

    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
