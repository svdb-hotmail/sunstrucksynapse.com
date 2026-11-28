import { expect, test } from "@playwright/test";

test("mobile navigation keeps Home, Explore, Queue, and About reachable", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav.getByRole("link")).toHaveText(["Home", "Explore"]);
  await expect(nav.getByRole("button", { name: "Queue, 0 tracks" })).toBeInViewport();
  await expect(page.getByRole("link", { name: "About", exact: true })).toBeInViewport();

  await nav.getByRole("link", { name: "Explore" }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.locator(".site-footer")).toHaveCount(0);
  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator(".site-footer")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "About", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByText("How is personal information handled?", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Read the privacy notice" })).toBeVisible();

  await nav.getByRole("button", { name: "Queue, 0 tracks" }).click();
  await expect(page.getByRole("region", { name: "Listening queue" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Listening queue" })).toBeHidden();
  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
});
