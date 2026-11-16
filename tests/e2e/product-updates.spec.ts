import { expect, test } from "@playwright/test";
import { APP_VERSION } from "../../app/data/product-releases";
import { serveSeekableMedia } from "./listener-helpers";

const versionLabel = `SunSyn v${APP_VERSION}: view release notes`;

test("opens release notes with keyboard focus and keeps music playing through the history", async ({
  page,
}) => {
  await serveSeekableMedia(page);
  await page.goto("/");
  await page.locator(".label-feature").getByRole("button", { name: "Play", exact: true }).click();
  const audio = page.locator("audio");
  await expect
    .poll(() => audio.evaluate((media: HTMLMediaElement) => !media.paused && media.currentTime > 0))
    .toBe(true);
  const originalAudio = await audio.elementHandle();
  expect(originalAudio).not.toBeNull();
  const badge = page.getByRole("button", { name: versionLabel });
  await badge.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "What’s new at SunSyn" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close release notes" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(badge).toBeFocused();
  await badge.click();
  await dialog.getByRole("link", { name: "View full release history" }).click();
  await expect(page).toHaveURL(/\/updates$/);
  await expect(page.getByRole("heading", { name: "Release history", exact: true })).toBeVisible();
  await expect(dialog).not.toBeVisible();
  expect(await originalAudio!.evaluate((media) => media.isConnected)).toBe(true);
  await expect.poll(() => audio.evaluate((media: HTMLMediaElement) => !media.paused)).toBe(true);
  await page.getByRole("link", { name: `v${APP_VERSION}`, exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/updates#release-${APP_VERSION.replaceAll(".", "\\.")}$`),
  );
  await expect(page.locator(`[id="release-${APP_VERSION}"]`)).toHaveCount(1);
});

test("keeps the badge and release notes usable on a phone in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/updates");
  const backgrounds: string[] = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const badge = page.getByRole("button", { name: versionLabel });
    await expect(badge).toBeInViewport();
    await badge.click();
    const dialog = page.getByRole("dialog", { name: "What’s new at SunSyn" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.height).toBeLessThanOrEqual(844);
    backgrounds.push(await dialog.evaluate((element) => getComputedStyle(element).backgroundColor));
    await page.screenshot({ path: test.info().outputPath(`release-notes-${theme}.png`) });
    await dialog.getByRole("button", { name: "Close release notes" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
});

test("serves a shareable release history without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto(`/updates#release-${APP_VERSION}`);
    await expect(
      page.getByRole("heading", { name: "What’s new at SunSyn", exact: true }),
    ).toBeVisible();
    await expect(page.locator(`[id="release-${APP_VERSION}"]`)).toContainText(`v${APP_VERSION}`);
  } finally {
    await context.close();
  }
});
