import { expect, test } from "@playwright/test";
import { APP_VERSION } from "../../app/data/product-releases";

const versionLabel = `SunSyn v${APP_VERSION}: view release notes`;

test("keeps the badge and release notes usable on a phone in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/updates?skin=pixel");
  const header = page.getByRole("banner");
  const about = header.getByRole("link", { name: "About", exact: true });
  const picker = header.locator(".skin-picker summary");
  await expect(about).toBeInViewport({ ratio: 1 });
  await expect(picker).toBeInViewport({ ratio: 1 });
  await expect(header.getByRole("link", { name: "SunSyn Radio home" })).toBeInViewport({
    ratio: 1,
  });
  await expect(header.getByRole("button", { name: /light mode/i })).toBeInViewport({ ratio: 1 });
  await header.screenshot({ path: test.info().outputPath("mobile-header.png") });
  const backgrounds: string[] = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const badge = page.getByRole("button", { name: versionLabel });
    await expect(badge).toBeInViewport({ ratio: 1 });
    await badge.click();
    const dialog = page.getByRole("dialog", { name: "What’s new at SunSyn" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    expect(box!.height).toBeLessThanOrEqual(844);
    backgrounds.push(await dialog.evaluate((element) => getComputedStyle(element).backgroundColor));
    await page.screenshot({ path: test.info().outputPath(`release-notes-${theme}.png`) });
    await dialog.getByRole("button", { name: "Close release notes" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await about.click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(header.getByRole("button", { name: versionLabel })).toBeInViewport({ ratio: 1 });
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
});
