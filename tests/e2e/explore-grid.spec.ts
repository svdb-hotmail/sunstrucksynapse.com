import { expect, test } from "@playwright/test";

test("Explore separates media types and opens the selected track on its release", async ({
  page,
}) => {
  await page.goto("/search?view=latest");
  const cards = page.locator(".explore-card");
  await expect(cards).toHaveCount(6);
  await expect(page.locator(".track-menu")).toHaveCount(0);
  await expect(cards.first().getByRole("button", { name: /^Play / })).toBeVisible();
  await expect(cards.first().getByRole("button", { name: /^Add .* to queue$/ })).toBeVisible();
  await cards
    .first()
    .getByRole("button", { name: /^Add .* to queue$/ })
    .click();
  await expect(cards.first().locator(".track-queue")).toBeDisabled();

  await page
    .getByRole("navigation", { name: "Explore views" })
    .getByRole("link", { name: "Videos" })
    .click();
  await expect(cards).toHaveCount(3);
  await page
    .getByRole("navigation", { name: "Explore views" })
    .getByRole("link", { name: "Audio" })
    .click();
  await expect(cards).toHaveCount(3);

  await cards.first().locator(".media-card-artist").click();
  await expect(page).toHaveURL(/\/artists\/sunstruck-synapse$/);
  await page.goto("/search?view=audio");
  await page.locator(".explore-card .media-card-title").first().click();
  await expect(page).toHaveURL(/\/releases\/phase-zero-transmissions#track-/);
  await expect(page.locator(".entity-track-list > li[data-targeted='true']")).toHaveCount(1);
});
