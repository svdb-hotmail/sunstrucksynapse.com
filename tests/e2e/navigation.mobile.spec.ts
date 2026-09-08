import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectSingleRow(nav: Locator) {
  const links = nav.getByRole("link");
  const bounds = await links.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
    }),
  );
  expect(
    Math.max(...bounds.map((rect) => rect.top)) - Math.min(...bounds.map((rect) => rect.top)),
  ).toBeLessThan(2);
  for (const link of await links.all()) await expect(link).toBeInViewport();
}

async function expectHashTarget(page: Page, id: string) {
  await expect(page).toHaveURL(new RegExp(`/#${id}$`));
  const target = page.locator(`#${id}`);
  await expect(target).toBeVisible();
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 0 && bounds.top < window.innerHeight && bounds.bottom > 0;
      }),
    )
    .toBe(true);
}

test("sparse mobile navigation keeps Listen, Search and About accessible in one row", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "sparse-r2" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/submission-terms");
  const nav = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["Listen", "Search", "About"]);
  await expectSingleRow(nav);
  await nav.getByRole("link", { name: "Listen", exact: true }).click();
  await expectHashTarget(page, "catalogue");
  await expect(page.locator("#catalogue .media-card")).toHaveCount(1);
  await expect(page.locator("#collection-stillith")).toBeVisible();
  await expect(page.locator("#latest, #audio, #video")).toHaveCount(0);
  await nav.getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(
    page.getByRole("heading", { name: "Search the collection", exact: true }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: "About", exact: true })).toHaveAttribute(
    "href",
    "/about",
  );
  await nav.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1, name: "About SunSyn Radio" })).toBeVisible();
  await expect(page.locator(".offerings")).toBeVisible();
  await expect(page.locator(".contact")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Policy pages" })).toBeVisible();
  await expect(page.locator(".panel-footer")).toHaveCount(0);
  const policyNav = page.getByRole("navigation", { name: "Policy pages" });
  for (const [label, href, heading] of [
    ["Privacy", "/privacy", "Privacy notice"],
    ["Submission terms", "/submission-terms", "Submission terms"],
    ["Takedown", "/takedown", "Content takedown process"],
  ] as const) {
    const link = policyNav.getByRole("link", { name: label, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await page.goto("/about");
  }
  await expectSingleRow(nav);
});

test("all five standard mobile links remain in one row and reach their destinations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/search");
  const nav = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["Latest", "Listen", "Watch", "Search", "About"]);
  await expectSingleRow(nav);
  for (const [label, id] of [
    ["Latest", "latest"],
    ["Listen", "audio"],
    ["Watch", "video"],
  ]) {
    await nav.getByRole("link", { name: label!, exact: true }).click();
    await expectHashTarget(page, id!);
  }
  await expect(nav.getByRole("link", { name: "About", exact: true })).toHaveAttribute(
    "href",
    "/about",
  );
  await nav.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1, name: "About SunSyn Radio" })).toBeVisible();
  await expect(page.locator(".offerings")).toBeVisible();
  await expect(page.locator(".contact")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Policy pages" })).toBeVisible();
  await expect(page.locator(".panel-footer")).toHaveCount(0);
  await nav.getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(
    page.getByRole("heading", { name: "Search the collection", exact: true }),
  ).toBeVisible();
  await expectSingleRow(nav);
});
