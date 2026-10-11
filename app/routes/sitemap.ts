import type { LoaderFunctionArgs } from "react-router";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { publicSitemap } from "~/utils/sitemap";
export async function loader({ context }: LoaderFunctionArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  try {
    const items = await catalogueRepository.listPublishedTracks();
    const collections = await catalogueRepository.listPublishedCollections(items);
    return new Response(publicSitemap(items, collections), {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  } catch {
    return new Response("Catalogue unavailable.", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}
