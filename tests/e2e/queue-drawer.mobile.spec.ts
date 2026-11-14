import { expect, test } from "@playwright/test";

test("mobile queue stays above the player, resizes, and exposes history", async ({ page }) => {
  await page.goto("/search");
  await page
    .locator(".media-card")
    .filter({ has: page.getByRole("link", { name: "Quiet Machines", exact: true }) })
    .getByRole("button", { name: "Add Quiet Machines to queue" })
    .click();

  const drawer = page.locator(".queue-pullout");
  const nav = page.locator(".mobile-tabs");
  await expect(drawer).toBeVisible();
  await expect(nav).toBeVisible();
  await expect
    .poll(async () => {
      const drawerBox = await drawer.boundingBox();
      const dockBox = await page.locator(".player-dock").boundingBox();
      return drawerBox && dockBox ? Math.abs(drawerBox.y + drawerBox.height - dockBox.y) : Infinity;
    })
    .toBeLessThan(3);

  const remove = drawer.getByRole("button", { name: "Remove Quiet Machines from queue" });
  await expect(remove.locator("svg")).toBeVisible();
  await expect(remove).not.toHaveText("Remove");
  await remove.click();
  await expect(drawer.getByText("Queue is clear.", { exact: false })).toBeVisible();

  await drawer.getByRole("tab", { name: /History/ }).click();
  await expect(drawer.getByText("Tracks you finish listening to will appear here.")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Clear all" })).toBeDisabled();

  const handle = drawer.getByRole("button", { name: "Resize queue; click to close" });
  const before = await drawer.boundingBox();
  const box = await handle.boundingBox();
  if (!before || !box) throw new Error("Queue drawer bounds unavailable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 80, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => (await drawer.boundingBox())?.height ?? 0)
    .toBeGreaterThan(before.height);
  await handle.click();
  await expect(drawer).toBeHidden();
});
