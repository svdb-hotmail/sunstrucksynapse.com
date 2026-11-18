import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
export function trackCard(page: Page, title: string) {
  return page
    .locator(".media-card")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) })
    .first();
}
export async function queueTrack(page: Page, title: string) {
  if (!(await trackCard(page, title).count())) {
    const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
    const navigation = (await mobileNavigation.isVisible())
      ? mobileNavigation
      : page.getByRole("navigation", { name: "Primary", exact: true });
    await navigation.getByRole("link", { name: "Explore", exact: true }).click();
  }
  const card = trackCard(page, title);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: `Add ${title} to queue`, exact: true }).click();
}
export async function viewTrack(page: Page, title: string) {
  await trackCard(page, title).getByRole("link", { name: title, exact: true }).click();
}
export async function openQueue(page: Page) {
  const drawer = page.locator(".queue-pullout");
  if (await drawer.isVisible()) return;
  const mobileQueue = page.getByRole("button", { name: /^Queue, \d+ tracks?$/ });
  if (await mobileQueue.isVisible()) {
    await mobileQueue.click();
    return;
  }
  await page.getByRole("button", { name: /^Open queue in dock, \d+ tracks$/ }).click();
}
export async function closePanel(page: Page) {
  const mobileHandle = page.getByRole("button", {
    name: "Resize queue; click to close",
    exact: true,
  });
  if (await mobileHandle.isVisible()) {
    await mobileHandle.click();
    return;
  }
  const queueClose = page.getByRole("button", { name: "Close queue", exact: true });
  if (await queueClose.isVisible()) await queueClose.click();
  else await page.getByRole("button", { name: "Close listening panel", exact: true }).click();
}

/** Give real fixture media seekable byte ranges; never simulate playback or ended. */
export async function serveSeekableMedia(page: Page) {
  await page.route(/\/assets\/(audio|video)\//, async (route) => {
    const url = new URL(route.request().url());
    const filename = path.resolve("public", decodeURIComponent(url.pathname).slice(1));
    if (!filename.startsWith(path.resolve("public/assets") + path.sep))
      throw new Error("Invalid fixture path");
    const bytes = await readFile(filename);
    const match = route
      .request()
      .headers()
      .range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const end = Math.min(match?.[2] ? Number(match[2]) : bytes.length - 1, bytes.length - 1);
    const body = bytes.subarray(start, end + 1);
    await route.fulfill({
      status: match ? 206 : 200,
      headers: {
        "content-type": filename.endsWith(".mp4") ? "video/mp4" : "audio/mpeg",
        "accept-ranges": "bytes",
        "content-length": String(body.length),
        ...(match ? { "content-range": `bytes ${start}-${end}/${bytes.length}` } : {}),
      },
      body,
    });
  });
}
