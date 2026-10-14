import { SITE_URL } from "~/config/brand";
export function loader() {
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /curator\nDisallow: /submit/\nDisallow: /submission-evidence/\nDisallow: /api/\nDisallow: /media/\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
