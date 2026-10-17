import { expect, test } from "@playwright/test";
import { serveSeekableMedia } from "./listener-helpers";
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveSeekableMedia(page);
});
const title = "Sunstruck Synapse (Revolution will be televised)";
const mushroom = "The Mushroom Circle (Gnome Revolution)";
const href = "/tracks/phase-zero-transmissions/revolution-will-be-televised";

test("static audio resumes from its card and restored track page without restarting the media", async ({
  page,
}) => {
  await page.goto("/");
  const row = card(page, title),
    audio = page.locator("audio");
  await row.getByRole("button", { name: `Play ${title}`, exact: true }).click();
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.currentTime))
    .toBeGreaterThan(1);
  await row.getByRole("button", { name: `Pause ${title}`, exact: true }).click();
  const pausedTime = await audio.evaluate((element: HTMLMediaElement) => {
    element.dataset.resumeProbe = "same-element";
    element.dataset.loadStarts = "0";
    element.addEventListener("loadstart", () => {
      element.dataset.loadStarts = String(Number(element.dataset.loadStarts) + 1);
    });
    return element.currentTime;
  });
  await row.getByRole("button", { name: `Play ${title}`, exact: true }).click();
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.currentTime))
    .toBeGreaterThan(pausedTime);
  await expect(audio).toHaveAttribute("data-resume-probe", "same-element");
  await expect(audio).toHaveAttribute("data-load-starts", "0");
  await row.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause track", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Play track", exact: true })).toBeVisible();
  await expect.poll(() => audio.evaluate((element: HTMLMediaElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Play track", exact: true }).click();
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLMediaElement) => !element.paused && element.currentTime > 0),
    )
    .toBe(true);
});
const card = (page: import("@playwright/test").Page, name: string) =>
  page
    .locator(".media-card")
    .filter({ has: page.getByRole("link", { name, exact: true }) })
    .first();
async function queueTrack(page: import("@playwright/test").Page, name: string) {
  const row = card(page, name);
  await row.locator(".track-menu > summary").click();
  await row.getByRole("button", { name: `Queue ${name}`, exact: true }).click();
}
for (const width of [320, 360, 390]) {
  test(`radio entry and a shared track fit a ${width}px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : width === 360 ? 640 : 844 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "SunSyn Radio home" })).toBeVisible();
    await expect(page.locator(".site-wordmark")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play the selection", exact: true }),
    ).toBeInViewport();
    await expect(page.locator(".player-dock")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto(href);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Play track", exact: true })).toBeInViewport();
    await page.getByRole("button", { name: "Play track", exact: true }).click();
    const audio = page.getByLabel(`${title} audio player`);
    await expect
      .poll(() => audio.evaluate((e: HTMLMediaElement) => !e.paused && e.currentTime > 0))
      .toBe(true);
    await expect(
      page.getByRole("button", { name: `Open player: ${title}`, exact: true }),
    ).toBeVisible();
    expect(
      await page.locator(".player-dock").evaluate((e) => e.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(70);
  });
}
test("one-tap selection queues real editorial order and browsing retains audio, focus and position", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play the selection", exact: true }).click();
  const audio = page.locator("audio");
  await expect
    .poll(() => audio.evaluate((e: HTMLMediaElement) => !e.paused && e.currentTime > 0))
    .toBe(true);
  await audio.evaluate((e) => Reflect.set(globalThis, "__radioAudio", e));
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: /Queue,/ })
    .click();
  await expect(page.getByRole("dialog", { name: "Your queue" })).toBeVisible();
  await expect(page.locator(".queue ol>li")).toHaveCount(1);
  await page.getByRole("button", { name: "Close listening panel" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Explore", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeInViewport();
  expect(await audio.evaluate((e) => e === Reflect.get(globalThis, "__radioAudio"))).toBe(true);
  await card(page, mushroom)
    .getByRole("button", { name: `Play ${mushroom}`, exact: true })
    .scrollIntoViewIfNeeded();
  // Let Playwright bring the control above the fixed dock before measuring app scrolling.
  await card(page, mushroom)
    .getByRole("button", { name: `Play ${mushroom}`, exact: true })
    .click({ trial: true });
  const before = await page.evaluate(() => scrollY);
  await card(page, mushroom)
    .getByRole("button", { name: `Play ${mushroom}`, exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
  await expect(
    card(page, mushroom).getByRole("button", { name: `Pause ${mushroom}`, exact: true }),
  ).toBeFocused();
});
test("queue count, duplicate feedback, reorder, undo and play next work from track menus", async ({
  page,
}) => {
  await page.goto("/search");
  await queueTrack(page, title);
  await expect(page.getByRole("status").filter({ hasText: /Added to queue/ })).toBeVisible();
  await queueTrack(page, mushroom);
  await queueTrack(page, mushroom);
  await expect(page.getByRole("status").filter({ hasText: /Already/ })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Queue, 2 tracks", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Your queue" });
  await dialog.getByRole("button", { name: `Move ${mushroom} up`, exact: true }).click();
  await expect(dialog.locator(".queue ol>li").first()).toContainText(mushroom);
  await dialog.getByRole("button", { name: `Remove ${mushroom} from queue`, exact: true }).click();
  await expect(dialog.locator(".queue ol>li")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.locator(".queue ol>li")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(dialog.locator(".queue ol>li")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.locator(".queue ol>li")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Close listening panel" }).click();
  await card(page, title).locator(".track-menu > summary").click();
  await card(page, title).getByRole("button", { name: "Play next", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Queue, 2 tracks", exact: true })
    .click();
  await expect(dialog.locator(".queue ol>li").first()).toContainText(title);
});
test("full player shares the current track and closing restores focus without stopping audio", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => Reflect.set(globalThis, "__sharedUrl", data.url),
    }),
  );
  await page.goto(href);
  await page.getByRole("button", { name: "Play track", exact: true }).click();
  const open = page.getByRole("button", { name: `Open player: ${title}`, exact: true });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Now playing" });
  await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Share", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, "__sharedUrl")))
    .toBe(`https://sunstrucksynapse.com${href}`);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await expect
    .poll(() => page.locator("audio").evaluate((e: HTMLMediaElement) => !e.paused))
    .toBe(true);
});
test("Explore keeps results near the search and hides missing facets", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "sparse-r2" });
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeInViewport();
  await page.getByLabel("Search artists, releases and tracks", { exact: true }).fill("Revolution");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("1 matching track.", { exact: true })).toBeInViewport();
  await expect(page.getByLabel("Search artists, releases and tracks", { exact: true })).toHaveValue(
    "Revolution",
  );
  await page.locator(".listener-filters summary").click();
  await expect(page.getByRole("combobox")).toHaveCount(0);
});
