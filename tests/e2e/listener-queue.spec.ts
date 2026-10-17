import { expect, test, type Page } from "@playwright/test";
import { closePanel, serveSeekableMedia, trackCard } from "./listener-helpers";

const a = "Sunstruck Synapse (Revolution will be televised)";
const b = "The Mushroom Circle (Gnome Revolution)";
const c = "Third transmission";
const outside = "Outside transmission";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "listener-boundaries" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveSeekableMedia(page);
});

async function playNext(page: Page, title: string) {
  const card = trackCard(page, title);
  await card.locator(".track-menu > summary").click();
  await card.getByRole("button", { name: "Play next", exact: true }).click();
}

async function finish(page: Page, title: string) {
  await expect(page.locator(".dock-track strong")).toHaveText(title);
  const media = page.locator("audio");
  await expect
    .poll(() =>
      media.evaluate(
        (element: HTMLMediaElement) =>
          !element.paused &&
          element.currentTime > 0 &&
          element.duration > 0 &&
          element.seekable.length > 0 &&
          element.seekable.end(element.seekable.length - 1) >= element.duration - 0.2,
      ),
    )
    .toBe(true);
  await media.evaluate((element: HTMLMediaElement) => {
    element.currentTime = element.duration - 0.15;
  });
}

async function expectEnded(page: Page, title: string) {
  await expect
    .poll(() => page.locator("audio").evaluate((element: HTMLMediaElement) => element.ended))
    .toBe(true);
  await expect(page.locator(".dock-track strong")).toHaveText(title);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
}

test("Play next changes finite selection order, Undo restores it, and endings never replay a consumed track", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play the selection", exact: true }).click();
  await playNext(page, c);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Queue, 2 tracks", exact: true }).click();
  await expect(page.locator(".queue ol>li").first()).toContainText(b);
  await closePanel(page);
  await playNext(page, c);
  for (const title of [a, c, b]) await finish(page, title);
  await expectEnded(page, b);
});

test("Play next handles already-played and outside tracks without losing the selection boundary", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play the selection", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".dock-track strong")).toHaveText(b);
  await playNext(page, a);
  await playNext(page, outside);
  for (const title of [b, outside, a, c]) await finish(page, title);
  await expectEnded(page, c);
});

test("choosing a later queue item plays the remaining entries once in their surviving order", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play the selection", exact: true }).click();
  await page.getByRole("button", { name: "Queue, 2 tracks", exact: true }).click();
  await page.getByRole("button", { name: `Play ${c} from queue`, exact: true }).click();
  for (const title of [c, b]) await finish(page, title);
  await expectEnded(page, b);
});

test("Previous retains album provenance after reload and interruption by an unrelated track", async ({
  page,
}) => {
  await page.goto("/releases/phase-zero-transmissions");
  await page.getByRole("button", { name: "Play album", exact: true }).click();
  for (const title of [a, b, c]) await finish(page, title);
  await expectEnded(page, c);
  await page.reload();
  await page.getByRole("button", { name: `Open player: ${c}`, exact: true }).click();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".dock-track strong")).toHaveText(b);
  await closePanel(page);
  await page.getByRole("link", { name: "Back to catalogue", exact: true }).click();
  await trackCard(page, outside)
    .getByRole("button", { name: `Play ${outside}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await finish(page, c);
  await expectEnded(page, c);
});

test("cross-release selection provenance survives Previous and interruption without becoming an album", async ({
  page,
}) => {
  await page.goto("/collections/cross-release");
  await page.getByRole("button", { name: "Play collection", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".dock-track strong")).toHaveText(outside);
  await page.getByRole("button", { name: `Open player: ${outside}`, exact: true }).click();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await closePanel(page);
  await page.getByRole("link", { name: "Back to catalogue", exact: true }).click();
  await trackCard(page, b)
    .getByRole("button", { name: `Play ${b}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  for (const title of [outside, c]) await finish(page, title);
  await expectEnded(page, c);
});
