import { expect, test } from "@playwright/test";

test("completes the listener flow without horizontal overflow on mobile", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Listen" })
    .click();
  await expect(page).toHaveURL(/#audio$/);
  await expect(page.locator("#audio")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("#audio").evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 0 && bounds.top < window.innerHeight && bounds.bottom > 0;
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
    })),
  ).toEqual(
    expect.objectContaining({
      body: expect.any(Number),
      viewport: expect.any(Number),
    }),
  );
  expect(
    await page.evaluate(() => document.body.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  expect(
    await page.locator(".player-panel").evaluate((element) => getComputedStyle(element).position),
  ).toBe("relative");

  await page
    .locator(".media-card")
    .filter({ hasText: "The Mushroom Circle (Gnome Revolution)" })
    .first()
    .getByRole("button", { name: "Play The Mushroom Circle (Gnome Revolution)" })
    .click();
  await expect(
    page.getByLabel("The Mushroom Circle (Gnome Revolution) audio player"),
  ).toBeVisible();
  await expect(
    page.getByLabel("The Mushroom Circle (Gnome Revolution) audio player").locator("source"),
  ).toHaveAttribute("src", "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3");
  await expect
    .poll(() =>
      page
        .getByLabel("The Mushroom Circle (Gnome Revolution) audio player")
        .evaluate((element: HTMLMediaElement) => element.paused),
    )
    .toBe(false);
  await page
    .locator(".media-card")
    .filter({ hasText: "Gone Fishing" })
    .first()
    .getByRole("button", { name: "Queue Gone Fishing" })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Gone Fishing video player").locator("source")).toHaveAttribute(
    "src",
    "/assets/video/gone_fishing.mp4",
  );
  await page.getByRole("link", { name: "View track" }).first().click();
  await expect(page.locator(".entity-page")).toBeVisible();
});
