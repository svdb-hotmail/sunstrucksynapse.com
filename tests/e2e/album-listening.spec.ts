import { expect, test } from "@playwright/test";
import { serveSeekableMedia } from "./listener-helpers";

test("plays an album in order, retains playback through navigation and stops at the album boundary", async ({
  page,
}) => {
  await serveSeekableMedia(page);
  await page.goto("/releases/phase-zero-transmissions");
  const playable = await page
    .locator(".entity-track-list > li")
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) => !element.querySelector<HTMLButtonElement>(".listener-track__play")?.disabled,
        )
        .map((element) => element.querySelector(".media-card-title")!.textContent!),
    );
  expect(playable.length).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Play album", exact: true }).click();
  const panel = page.locator(".player-panel"),
    nowPlaying = panel.locator(".dock-track strong"),
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
