import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const revolutionTitle = "Sunstruck Synapse (Revolution will be televised)";
const revolutionSource = "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3";
const mushroomTitle = "The Mushroom Circle (Gnome Revolution)";

function cardFor(page: Page, title: string) {
  return page.locator(".media-card").filter({ hasText: title }).first();
}

test("loads the database catalogue and controls the correct media", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));

  await page.goto("/");

  await expect(page).toHaveTitle(/Sunstruck Synapse/);
  await expect(
    page.getByRole("heading", { name: "A radio for music made with intent." }),
  ).toBeVisible();
  await expect(page.locator(".media-card")).toHaveCount(9);
  await cardFor(page, revolutionTitle)
    .getByRole("button", { name: `Play ${revolutionTitle}` })
    .click();

  const audio = page.getByLabel(`${revolutionTitle} audio player`);
  await expect(audio.locator("source")).toHaveAttribute("src", revolutionSource);
  await expect(audio).toHaveAttribute("controls", "");
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.readyState))
    .toBeGreaterThan(0);
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.paused))
    .toBe(false);
  const seekAccepted = await audio.evaluate((element: HTMLMediaElement) => {
    element.pause();
    element.currentTime = 1;
    element.volume = 0.4;
    return Number.isFinite(element.currentTime);
  });
  expect(seekAccepted).toBe(true);
  expect(await audio.evaluate((element: HTMLMediaElement) => element.volume)).toBeCloseTo(0.4);

  await page.getByRole("button", { name: "Next", exact: true }).click();
  const video = page.getByLabel("Final Movie 00007 video player");
  await expect(video).toBeVisible();
  await expect(video.locator("source")).toHaveAttribute(
    "src",
    "/assets/video/final-movie_00007_.mp4",
  );
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByLabel(`${revolutionTitle} audio player`)).toBeVisible();

  const mediaSessionTitle = await page.evaluate(
    () => navigator.mediaSession?.metadata?.title ?? null,
  );
  expect(mediaSessionTitle).toBe(revolutionTitle);
  expect(browserErrors).toEqual([]);
});

test("supports queue removal, next priority and automatic advancement", async ({ page }) => {
  await page.goto("/");

  await cardFor(page, revolutionTitle)
    .getByRole("button", { name: `Play ${revolutionTitle}` })
    .click();
  await cardFor(page, mushroomTitle)
    .getByRole("button", { name: `Queue ${mushroomTitle}` })
    .click();

  const queue = page.getByRole("heading", { name: "Next in queue" }).locator("..").locator("..");
  await expect(queue.getByRole("listitem")).toHaveCount(1);
  await queue.getByRole("button", { name: `Remove ${mushroomTitle} from queue` }).click();
  await expect(queue.getByText("Queue is clear.")).toBeVisible();

  await cardFor(page, mushroomTitle)
    .getByRole("button", { name: `Queue ${mushroomTitle}` })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel(`${mushroomTitle} audio player`)).toBeVisible();
  await expect(queue.getByText("Queue is clear.")).toBeVisible();

  await cardFor(page, "Gone Fishing").getByRole("button", { name: "Queue Gone Fishing" }).click();
  await page.getByLabel(`${mushroomTitle} audio player`).dispatchEvent("ended");
  await expect(page.getByLabel("Gone Fishing video player")).toBeVisible();
  await expect(queue.getByText("Queue is clear.")).toBeVisible();
});

test("keeps playback through internal navigation and restores state without autoplay", async ({
  page,
}) => {
  await page.goto("/");
  const revolutionCard = cardFor(page, revolutionTitle);

  await revolutionCard.getByRole("button", { name: `Play ${revolutionTitle}` }).click();
  await cardFor(page, mushroomTitle)
    .getByRole("button", { name: `Queue ${mushroomTitle}` })
    .click();

  const audio = page.getByLabel(`${revolutionTitle} audio player`);
  await audio.evaluate((element: HTMLMediaElement) => {
    element.dataset.persistenceProbe = "kept";
    element.pause();
  });
  await revolutionCard.getByRole("link", { name: "View track" }).click();

  await expect(page).toHaveURL(/\/tracks\/phase-zero-transmissions\/revolution-will-be-televised$/);
  await expect(page.getByLabel(`${revolutionTitle} audio player`)).toHaveAttribute(
    "data-persistence-probe",
    "kept",
  );
  await page.waitForFunction(() =>
    window.localStorage.getItem("sunstruck-synapse-player-v1")?.includes("000000000104"),
  );
  await page.reload();

  const restoredAudio = page.getByLabel(`${revolutionTitle} audio player`);
  await expect(restoredAudio.locator("source")).toHaveAttribute("src", revolutionSource);
  expect(await restoredAudio.evaluate((element: HTMLMediaElement) => element.paused)).toBe(true);
  await expect(
    page.getByRole("button", { name: `Play ${mushroomTitle} from queue` }),
  ).toBeVisible();
});

test("serves canonical artist, release and track pages with global-player actions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        Reflect.set(globalThis, "__sharedUrl", data.url);
      },
    });
  });

  await page.goto("/artists/sunstruck-synapse");
  await expect(page.getByRole("heading", { name: "Sunstruck Synapse", exact: true })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(5);

  await page.goto("/releases/phase-zero-transmissions");
  await expect(
    page.getByRole("heading", { name: "Phase Zero Transmissions", exact: true }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/releases\/phase-zero-transmissions$/,
  );

  await page.goto("/tracks/phase-zero-transmissions/revolution-will-be-televised");
  await expect(page).toHaveTitle(new RegExp(revolutionTitle.replace(/[()]/g, "\\$&")));
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "music.song");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/tracks\/phase-zero-transmissions\/revolution-will-be-televised$/,
  );
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, "__sharedUrl")))
    .toMatch(/\/tracks\/phase-zero-transmissions\/revolution-will-be-televised$/);

  await page.getByRole("button", { name: "Play in global player" }).click();
  await expect(
    page.getByLabel(`${revolutionTitle} audio player`).locator("source"),
  ).toHaveAttribute("src", revolutionSource);

  const missing = await page.goto("/tracks/phase-zero-transmissions/not-published");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("reports unavailable media accessibly and allows retry", async ({ page }) => {
  await page.route("**/*.mp3", (route) => route.abort("failed"));
  await page.goto("/");

  await cardFor(page, revolutionTitle)
    .getByRole("button", { name: `Play ${revolutionTitle}` })
    .click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("could not be loaded");
  await expect(alert.getByRole("button", { name: "Retry" })).toBeVisible();
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(alert).toContainText(/unavailable|could not be loaded/);
});

test("supports keyboard activation and reduced-motion focus movement", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(globalThis, "__scrollBehavior", null);
    Element.prototype.scrollIntoView = function (options) {
      Reflect.set(
        globalThis,
        "__scrollBehavior",
        typeof options === "object" ? options.behavior : null,
      );
    };
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const viewTrack = cardFor(page, revolutionTitle).getByRole("link", { name: "View track" });
  await viewTrack.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/revolution-will-be-televised$/);

  await page.getByRole("link", { name: "Sunstruck Synapse Radio home" }).click();
  await cardFor(page, revolutionTitle)
    .getByRole("button", { name: `Play ${revolutionTitle}` })
    .click();
  expect(await page.evaluate(() => Reflect.get(globalThis, "__scrollBehavior"))).toBe("auto");
});
