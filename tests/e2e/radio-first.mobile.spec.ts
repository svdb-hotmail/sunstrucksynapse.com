import { expect, test } from "@playwright/test";
import { closePanel, openQueue, trackCard } from "./listener-helpers";

const title = "Sunstruck Synapse (Revolution will be televised)";

for (const width of [320, 360, 390]) {
  test(`mobile navigation and the catalogue fit a ${width}px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : width === 360 ? 640 : 844 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "SunSyn Radio home" })).toBeVisible();
    await expect(page.locator(".site-wordmark")).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(nav.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Explore", exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: /^Queue,/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await nav.getByRole("link", { name: "Explore", exact: true }).click();
    const card = trackCard(page, title);
    await expect(card).toBeVisible();
    await card.getByRole("link", { name: title, exact: true }).click();
    await expect(page).toHaveURL(
      /\/releases\/phase-zero-transmissions#track-revolution-will-be-televised$/,
    );
    await expect(page.locator("#track-revolution-will-be-televised")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("mobile queue drawer remains above the player and navigation while audio continues", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const audio = page.locator("audio");
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLMediaElement) => !element.paused && element.currentTime > 0),
    )
    .toBe(true);
  await audio.evaluate((element) => Reflect.set(globalThis, "__radioAudio", element));

  await openQueue(page);
  const panel = page.locator(".queue-pullout");
  const nav = page.locator(".mobile-tabs");
  const dock = page.locator(".player-dock");
  await expect(panel).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(dock).toBeVisible();
  await expect
    .poll(async () => {
      const panelBox = await panel.boundingBox();
      const dockBox = await dock.boundingBox();
      return panelBox && dockBox ? Math.abs(panelBox.y + panelBox.height - dockBox.y) : Infinity;
    })
    .toBeLessThan(3);
  await expect(page.locator(".queue-pullout .queue ol > li").first()).toHaveAttribute(
    "data-current",
    "true",
  );
  await closePanel(page);
  await expect(panel).toBeHidden();
  expect(
    await audio.evaluate((element) => element === Reflect.get(globalThis, "__radioAudio")),
  ).toBe(true);
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => !element.paused))
    .toBe(true);
});

test("mobile Explore adds, reorders, and removes tracks in the Queue tab", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "listener-boundaries" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/search?view=latest");

  await trackCard(page, title)
    .getByRole("button", { name: `Add ${title} to queue`, exact: true })
    .click();
  await closePanel(page);
  await trackCard(page, "Third transmission")
    .getByRole("button", { name: "Add Third transmission to queue", exact: true })
    .click();
  await openQueue(page);

  const panel = page.locator(".queue-pullout");
  const rows = panel.locator(".queue ol > li");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(title);
  await expect(rows.nth(1)).toContainText("Third transmission");
  await rows
    .nth(1)
    .getByRole("button", { name: "Drag Third transmission to reorder; use arrow keys to move it" })
    .press("ArrowUp");
  await expect(rows.first()).toContainText("Third transmission");
  await rows.first().getByRole("button", { name: "Remove Third transmission from queue" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(title);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
