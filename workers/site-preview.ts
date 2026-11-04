import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/config/cloudflare-context.server";
import { createE2eCatalogueRepository } from "../app/repositories/catalogue-fixture.server";
import { createStaticCatalogueRepository } from "../app/repositories/catalogue.server";

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
    const samples = createE2eCatalogueRepository();
    const items = (await samples.listPublishedTracks()).map((item) => ({
      ...item,
      artwork:
        item.slug === "revolution-will-be-televised"
          ? { src: "/assets/design-preview/signal.svg", alt: "Illustrative sample artwork" }
          : item.slug === "the-mushroom-circle-gnome-revolution"
            ? { src: "/assets/design-preview/bloom.svg", alt: "Illustrative sample artwork" }
            : item.artwork,
    }));
    const byId = new Map(items.map((item) => [item.id, item]));
    const collections = (await samples.listPublishedCollections()).map((collection) => ({
      ...collection,
      items: collection.items.map((item) => byId.get(item.id) ?? item),
    }));
    const catalogue = createStaticCatalogueRepository(items, collections);
    catalogue.findPublicTrackDisclosure = samples.findPublicTrackDisclosure;
    context.set(cloudflareContext, {
      catalogueRepository: catalogue,
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
