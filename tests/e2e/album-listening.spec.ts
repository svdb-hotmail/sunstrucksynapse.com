import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("plays an album in order, retains playback through navigation and stops at the album boundary", async ({
  page,
}) => {
  // The local asset preview streams without seekable ranges. Give fixture files
  // normal byte-range delivery; do not simulate playing, seeking or ended events.
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
  await page.goto("/releases/phase-zero-transmissions");
  const playable = await page
    .locator(".entity-track-list > li")
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) => !element.querySelector<HTMLButtonElement>("button:last-child")?.disabled,
        )
        .map((element) => element.querySelector("a")!.textContent!),
    );
  expect(playable.length).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Play album", exact: true }).click();
  const panel = page.locator(".player-panel"),
    nowPlaying = panel.locator(".now-playing .subtitle"),
    media = panel.locator("audio,video");
  await expect(nowPlaying).toHaveText(playable[0]);
  await expect
    .poll(() => media.evaluate((a: HTMLMediaElement) => a.currentTime))
    .toBeGreaterThan(0);
  const beforeNavigation = await media.evaluate((a: HTMLMediaElement) => a.currentTime);
  await page.getByRole("link", { name: "Back to catalogue" }).click();
  await expect(nowPlaying).toHaveText(playable[0]);
  await expect
    .poll(() => media.evaluate((a: HTMLMediaElement) => a.currentTime))
    .toBeGreaterThan(beforeNavigation);
  await page
    .locator(".album-shelf")
    .getByRole("link", { name: /Phase Zero Transmissions/ })
    .click();
  for (let index = 0; index < playable.length; index++) {
    await expect(nowPlaying).toHaveText(playable[index]);
    await expect
      .poll(() =>
        media.evaluate(
          (a: HTMLMediaElement) =>
            !a.paused &&
            Number.isFinite(a.duration) &&
            a.duration > 0 &&
            a.seekable.length > 0 &&
            a.seekable.end(a.seekable.length - 1) >= a.duration - 0.2,
        ),
      )
      .toBe(true);
    await media.evaluate((a: HTMLMediaElement) => {
      a.currentTime = a.duration - 0.15;
    });
    if (index + 1 < playable.length) await expect(nowPlaying).toHaveText(playable[index + 1]);
  }
  await expect.poll(() => media.evaluate((a: HTMLMediaElement) => a.ended)).toBe(true);
  await expect(nowPlaying).toHaveText(playable.at(-1)!);
  await expect(panel.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Back to catalogue" }).click();
  await expect(nowPlaying).toHaveText(playable.at(-1)!);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://sunstrucksynapse.com",
  );
});
