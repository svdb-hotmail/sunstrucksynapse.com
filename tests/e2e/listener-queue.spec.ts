import { expect, test } from "@playwright/test";
import { closePanel, openQueue, serveSeekableMedia } from "./listener-helpers";

const current = "Sunstruck Synapse (Revolution will be televised)";
const next = "The Mushroom Circle (Gnome Revolution)";
const last = "Third transmission";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "listener-boundaries" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveSeekableMedia(page);
});

async function startAlbum(page: import("@playwright/test").Page) {
  await page.goto("/collections/listen");
  await page.getByRole("button", { name: "Play collection", exact: true }).click();
}

test("queue rows are informational and do not change playback or close the panel", async ({
  page,
}) => {
  await startAlbum(page);
  await openQueue(page);

  const panel = page.locator(".queue-pullout");
  const rows = panel.locator(".queue ol > li");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toHaveAttribute("data-current", "true");
  await expect(rows.first()).toContainText(current);
  await rows.nth(1).getByText(next, { exact: true }).click();

  await expect(panel).toBeVisible();
  await expect(page.locator(".dock-track strong")).toHaveText(current);
  await expect(rows).toHaveCount(3);
});

test("reorders upcoming tracks with the keyboard while keeping the current track first", async ({
  page,
}) => {
  await startAlbum(page);
  await openQueue(page);

  const rows = page.locator(".queue-pullout .queue ol > li");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText(next);
  await expect(rows.nth(2)).toContainText(last);
  await rows
    .nth(2)
    .getByRole("button", { name: `Drag ${last} to reorder; use arrow keys to move it` })
    .press("ArrowUp");

  await expect(rows.nth(0)).toHaveAttribute("data-current", "true");
  await expect(rows.nth(1)).toContainText(last);
  await expect(rows.nth(2)).toContainText(next);
});

test("natural completion adds the current track to history and Clear All empties history", async ({
  page,
}) => {
  await startAlbum(page);
  await openQueue(page);
  const panel = page.locator(".queue-pullout");
  await panel.getByRole("tab", { name: /History/ }).click();
  await expect(panel.getByRole("tab", { name: /History/ })).toContainText("0");

  const audio = page.locator("audio");
  await expect
    .poll(() =>
      audio.evaluate(
        (element: HTMLMediaElement) =>
          element.duration > 0 &&
          element.seekable.length > 0 &&
          element.seekable.end(element.seekable.length - 1) >= element.duration - 0.2,
      ),
    )
    .toBe(true);
  await audio.evaluate((element: HTMLMediaElement) => {
    element.currentTime = element.duration - 0.15;
  });

  await expect(panel.getByRole("tab", { name: /History/ })).toContainText("1");
  await expect(panel.locator(".queue-history li").first()).toContainText(current);
  await panel
    .locator(".queue-history-section")
    .getByRole("button", { name: "Clear all", exact: true })
    .click();
  await expect(panel.getByText("Tracks you finish listening to will appear here.")).toBeVisible();
});

test("queue controls remain available after browsing away from the album", async ({ page }) => {
  await startAlbum(page);
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Explore", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeVisible();
  await openQueue(page);
  await expect(page.locator(".queue-pullout .queue ol > li").first()).toHaveAttribute(
    "data-current",
    "true",
  );
  await closePanel(page);
});
