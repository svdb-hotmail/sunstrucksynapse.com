import { expect, test } from "@playwright/test";
import { serveSeekableMedia } from "./listener-helpers";

test("restored paused media stays idle until playback is requested", async ({ page }) => {
  await serveSeekableMedia(page);
  await page.addInitScript(() => {
    document.addEventListener(
      "loadstart",
      (event) => {
        if (event.target instanceof HTMLMediaElement) event.target.dataset.loadstartSeen = "true";
      },
      true,
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start listening", exact: true }).click();
  const audio = page.locator("audio");
  await expect
    .poll(() => audio.evaluate((media: HTMLMediaElement) => !media.paused && media.currentTime > 0))
    .toBe(true);
  await expect(page.locator(".player-loading")).toHaveCount(0);
  await page.reload();
  await expect(audio).toHaveAttribute("data-loadstart-seen", "true");
  await expect.poll(() => audio.evaluate((media: HTMLMediaElement) => media.paused)).toBe(true);
  await expect(page.locator(".player-loading")).toHaveCount(0);
  await page.locator(".transport .dock-play").click();
  await expect
    .poll(() => audio.evaluate((media: HTMLMediaElement) => !media.paused && media.currentTime > 0))
    .toBe(true);
  await expect(page.locator(".player-loading")).toHaveCount(0);
});

test("signed playback shows loading while delivery is pending and clears it when playing", async ({
  page,
}) => {
  await serveSeekableMedia(page);
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "sparse-r2" });
  let releaseSigning!: () => void;
  const pendingSigning = new Promise<void>((resolve) => {
    releaseSigning = resolve;
  });
  await page.route("**/media/audio/e2e-revolution?playback=true", async (route) => {
    await pendingSigning;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        url: "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start listening", exact: true }).click();
  await expect(page.locator(".listener-feedback .player-loading")).toBeVisible();
  releaseSigning();
  const audio = page.locator("audio");
  await expect
    .poll(() => audio.evaluate((media: HTMLMediaElement) => !media.paused && media.currentTime > 0))
    .toBe(true);
  await expect(page.locator(".player-loading")).toHaveCount(0);
});
