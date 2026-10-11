import { expect, test } from "@playwright/test";

test("plays an album in order, retains playback through navigation and stops at the album boundary", async ({
  page,
}) => {
  await page.goto("/releases/phase-zero-transmissions");
  const rows = page.locator(".entity-track-list > li");
  const playable = await rows.evaluateAll((elements) =>
    elements
      .filter((element) => !element.querySelector<HTMLButtonElement>("button:last-child")?.disabled)
      .map((element) => element.querySelector("a")!.textContent!),
  );
  expect(playable.length).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Play album", exact: true }).click();
  const panel = page.locator(".player-panel");
  await expect(panel).toContainText(playable[0]);
  const media = panel.locator("audio,video");
  await expect
    .poll(() => media.evaluate((element: HTMLMediaElement) => element.paused))
    .toBe(false);
  await expect
    .poll(() => media.evaluate((element: HTMLMediaElement) => element.currentTime))
    .toBeGreaterThan(0);
  for (let index = 1; index < playable.length; index++) {
    await media.evaluate((element: HTMLMediaElement) => {
      element.currentTime = Math.max(0, element.duration - 0.15);
    });
    await expect(panel).toContainText(playable[index]);
    await expect
      .poll(() => media.evaluate((element: HTMLMediaElement) => element.paused))
      .toBe(false);
  }
  await media.evaluate((element: HTMLMediaElement) => {
    element.currentTime = Math.max(0, element.duration - 0.15);
  });
  await expect.poll(() => media.evaluate((element: HTMLMediaElement) => element.ended)).toBe(true);
  await expect(panel).toContainText(playable[playable.length - 1]);
  await page.getByRole("link", { name: "Back to catalogue" }).click();
  await expect(panel).toContainText(playable[playable.length - 1]);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://sunstrucksynapse.com",
  );
});
