import { SITE_URL } from "~/config/brand";
import type { CatalogueItem, PublicEditorialCollection } from "~/types/catalogue";
export function publicSitemap(items: CatalogueItem[], collections: PublicEditorialCollection[]) {
  const paths = new Set(["/", "/about", "/privacy"]);
  for (const item of items) {
    paths.add(item.href);
    paths.add(item.release.href);
    paths.add(item.creator.href);
  }
  for (const collection of collections)
    paths.add(`/collections/${encodeURIComponent(collection.slug)}`);
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
    ...paths,
  ]
    .filter(
      (path) =>
        path.startsWith("/") &&
        !path.startsWith("//") &&
        !/^\/(curator|submit|submission-evidence|media|api)(\/|$)/.test(path),
    )
    .map((path) => `<url><loc>${escape(new URL(path, SITE_URL).href)}</loc></url>`)
    .join("")}</urlset>`;
}
