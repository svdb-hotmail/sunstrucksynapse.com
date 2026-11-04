import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/config/cloudflare-context.server";
import { createE2eCatalogueRepository } from "../app/repositories/catalogue-fixture.server";

const handler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  "production",
);

/** Preview-only entry. No database, identity, storage or mutation repositories. */
export default {
  async fetch(request, _env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /\n", {
        headers: { "Content-Type": "text/plain", "X-Robots-Tag": "noindex, nofollow" },
      });
    }
    if (request.method === "POST" && path === "/api/events") {
      return new Response(null, { status: 204 });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("This design preview is read-only.", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }
    if (/^\/(submit|media|api)(?:\/|\.|$)/.test(path)) {
      return new Response("This private workflow is unavailable in the public design preview.", {
        status: 404,
      });
    }
    const context = new RouterContextProvider();
    context.set(cloudflareContext, {
      catalogueRepository: createE2eCatalogueRepository(),
      ctx,
    });
    const response = await handler(request, context);
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler;
