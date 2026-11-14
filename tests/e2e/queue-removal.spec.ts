import { expect, test } from "@playwright/test";
import { serveSeekableMedia, trackCard } from "./listener-helpers";

test("removing an upcoming track prevents it from playing after the current track ends", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "listener-boundaries" });
  await serveSeekableMedia(page);
  await page.goto("/search");

  const current = "Sunstruck Synapse (Revolution will be televised)";
  const removed = "The Mushroom Circle (Gnome Revolution)";
  const remaining = "Third transmission";
  await trackCard(page, current)
    .getByRole("button", { name: `Play ${current}` })
    .click();
  for (const title of [removed, remaining]) {
    await trackCard(page, title)
      .getByRole("button", { name: `Add ${title} to queue` })
      .click();
  }

  const queue = page.locator(".queue-pullout");
  await expect(queue).toBeVisible();
  await queue.getByRole("button", { name: `Remove ${removed} from queue` }).click();
  await expect(queue).not.toContainText(removed);
  await page.locator("audio").dispatchEvent("ended");
  await expect(page.locator(".dock-track strong")).toHaveText(remaining);

  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.locator("audio").dispatchEvent("ended");
  await expect(page.locator(".dock-track strong")).toHaveText(remaining);
});
