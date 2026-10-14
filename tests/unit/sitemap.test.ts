import { expect, it } from "vitest";
import { publicSitemap } from "../../app/utils/sitemap";
import { loader as robots } from "../../app/routes/robots";
import { makeCatalogueItem } from "../fixtures/catalogue";
it("lists public album routes once on the operational domain, excludes private routes and escapes XML", () => {
  const track = makeCatalogueItem("test");
  const xml = publicSitemap(
    [
      track,
      { ...track, id: "duplicate" },
      { ...track, id: "private", href: "/curator/submissions" },
    ],
    [],
  );
  expect(xml).toContain("https://sunstrucksynapse.com");
  expect(xml.split(`<loc>https://sunstrucksynapse.com${track.release.href}</loc>`)).toHaveLength(2);
  expect(xml).not.toContain("/curator");
  expect(publicSitemap([{ ...track, href: "/search?q=a&b=c" }], [])).toContain("&amp;");
});
it("robots excludes invitation and curator paths", async () => {
  const text = await robots().text();
  expect(text).toContain("Disallow: /curator");
  expect(text).toContain("Disallow: /submit/");
  expect(text).toContain("https://sunstrucksynapse.com/sitemap.xml");
});
