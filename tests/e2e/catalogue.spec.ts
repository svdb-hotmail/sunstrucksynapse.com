import { expect, test } from "@playwright/test";

test("finds an incomplete publication, explains visibility and retains the catalogue view", async ({
  browser,
}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-test-curator-identity": "catalogue-curator|curator@example.test",
    },
  });
  const page = await context.newPage();
  await page.goto("/curator");
  await expect(page.getByRole("heading", { name: "Catalogue", exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Catalogue views" })
      .getByRole("link", { name: /Needs attention/ }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Incomplete signal", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Incomplete signal" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Not live", exact: true })).toBeVisible();
  await expect(drawer).toContainText("release is marked published");
  await expect(drawer).toContainText("Publication affects the complete release");
  await expect(drawer.getByRole("link", { name: "Open complete release" })).toHaveAttribute(
    "href",
    /\/curator\/albums\?album=/,
  );
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(page).toHaveURL(/view=attention/);
  const views = page.getByRole("navigation", { name: "Catalogue views" });
  await views.getByRole("link", { name: /All tracks/ }).click();
  await page.getByRole("searchbox", { name: "Search catalogue" }).fill("Open frequency");
  await page
    .getByRole("search", { name: "" })
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page.locator(".catalogue-library tbody tr")).toHaveCount(1);
  await expect(page.locator(".catalogue-library")).toContainText("Live");
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Search catalogue" })).toHaveValue(
    "Open frequency",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".catalogue-mobile-state")).toContainText("Live");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await context.close();
});

test("groups ready tracks by complete release before handing off to audited publication", async ({
  browser,
}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-test-curator-identity": "catalogue-curator|curator@example.test",
    },
  });
  const page = await context.newPage();
  await page.goto("/curator?view=ready");
  await page.getByRole("checkbox", { name: "Select First light for release review" }).check();
  await page.getByRole("button", { name: "Review releases", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review complete releases" });
  await expect(review).toContainText("Selecting one track includes its full release");
  await expect(review.getByRole("link", { name: "Review release", exact: false })).toHaveAttribute(
    "href",
    "/curator/albums?album=e0000000-0000-4000-8000-000000000002",
  );
  await review.getByRole("button", { name: "Keep browsing" }).click();
  await expect(review).not.toBeVisible();
  await context.close();
});
