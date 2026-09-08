import { expect, test, type Page } from "@playwright/test";

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

test("sparse catalogue navigation resolves real content from non-home routes", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "sparse-r2" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/submission-terms");
  const nav = page.getByRole("navigation", { name: "Primary", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["Listen", "Search", "About"]);
  await expect(nav.getByRole("link", { name: "Listen", exact: true })).toHaveAttribute(
    "href",
    "/#catalogue",
  );
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
});

test("standard catalogue links target the corresponding actual collections", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/search");
  const nav = page.getByRole("navigation", { name: "Primary", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["Latest", "Listen", "Watch", "Search", "About"]);
  for (const [label, id] of [
    ["Latest", "latest"],
    ["Listen", "audio"],
    ["Watch", "video"],
  ]) {
    await nav.getByRole("link", { name: label!, exact: true }).click();
    await expectHashTarget(page, id!);
  }
});
