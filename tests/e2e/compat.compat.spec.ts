import { expect, test } from "@playwright/test";
import { serveSeekableMedia } from "./listener-helpers";

test("supports the critical listener journey across browser engines", async ({ page }) => {
  await serveSeekableMedia(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  const play = page
    .getByRole("button", {
      name: "Play Sunstruck Synapse (Revolution will be televised)",
    })
    .first();
  await play.focus();
  await expect(play).toBeFocused();
  await play.press("Enter");
  const audio = page.getByLabel("Sunstruck Synapse (Revolution will be televised) audio player");
  await expect(audio).toBeAttached();
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLMediaElement) => !element.paused && element.currentTime > 0),
    )
    .toBe(true);

  await page.keyboard.press("Tab");
  const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  expect(focusedRole).not.toBe("presentation");
});
