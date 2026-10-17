import { expect, test } from "@playwright/test";
import { queueTrack, trackCard, serveSeekableMedia } from "./listener-helpers";
test("completes the listener flow without horizontal overflow on mobile", async ({ page }) => {
  await serveSeekableMedia(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play the selection", exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await nav.getByRole("link", { name: "Explore", exact: true }).click();
  await queueTrack(page, "Gone Fishing");
  const title = "The Mushroom Circle (Gnome Revolution)";
  await trackCard(page, title)
    .getByRole("button", { name: `Play ${title}`, exact: true })
    .click();
  const audio = page.getByLabel(`${title} audio player`);
  await expect(audio.locator("source")).toHaveAttribute(
    "src",
    "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3",
  );
  await expect.poll(() => audio.evaluate((e: HTMLMediaElement) => e.paused)).toBe(false);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const video = page.getByLabel("Gone Fishing video player");
  await expect(video.locator("source")).toHaveAttribute("src", "/assets/video/gone_fishing.mp4");
  await page.getByRole("button", { name: "Open player: Gone Fishing", exact: true }).click();
  await expect(video).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
