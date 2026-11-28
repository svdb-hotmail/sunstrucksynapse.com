import { expect, test } from "@playwright/test";
import { serveSeekableMedia } from "./listener-helpers";
test("radio selection plays only its published audio order, retains the queue on reload, and ends at its boundary", async ({
  page,
}) => {
  await serveSeekableMedia(page);
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "listener-boundaries" });
  await page.goto("/collections/listen");
  await page.getByRole("button", { name: "Play collection", exact: true }).click();
  const nowPlaying = page.locator(".dock-track strong"),
    audio = page.locator("audio");
  const first = "Sunstruck Synapse (Revolution will be televised)",
    second = "The Mushroom Circle (Gnome Revolution)",
    last = "Third transmission";
  await expect(nowPlaying).toHaveText(first);
  await expect
    .poll(() => audio.evaluate((e: HTMLMediaElement) => !e.paused && e.currentTime > 0))
    .toBe(true);
  await page.reload();
  await expect(nowPlaying).toHaveText(first);
  await expect.poll(() => audio.evaluate((e: HTMLMediaElement) => e.paused)).toBe(true);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  for (const title of [first, second, last]) {
    await expect(nowPlaying).toHaveText(title);
    await expect
      .poll(() =>
        audio.evaluate(
          (e: HTMLMediaElement) =>
            !e.paused &&
            e.duration > 0 &&
            e.seekable.length > 0 &&
            e.seekable.end(e.seekable.length - 1) >= e.duration - 0.2,
        ),
      )
      .toBe(true);
    await audio.evaluate((e: HTMLMediaElement) => (e.currentTime = e.duration - 0.15));
  }
  await expect.poll(() => audio.evaluate((e: HTMLMediaElement) => e.ended)).toBe(true);
  await expect(nowPlaying).toHaveText(last);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
});
