import { expect, test } from "@playwright/test";

test("supports the critical listener journey across browser engines", async ({ page }) => {
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
  await expect(
    page.getByLabel("Sunstruck Synapse (Revolution will be televised) audio player"),
  ).toBeVisible();

  await page.keyboard.press("Tab");
  const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  expect(focusedRole).not.toBe("presentation");
});
