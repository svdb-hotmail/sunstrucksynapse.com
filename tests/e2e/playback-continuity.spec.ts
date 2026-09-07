import { expect, test } from "@playwright/test";

const revolutionTitle = "Sunstruck Synapse (Revolution will be televised)";

test("keeps signed playback active through loader refresh and refreshes only on resume/retry", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "sparse-r2" });

  const fixtureResponse = await page.request.get(
    "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
  );
  const fixtureBytes = await fixtureResponse.body();
  let mintCount = 0;
  let failNextMediaRequest = false;
  const playbackRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/events") && request.method() === "POST") {
      try {
        const eventName = (JSON.parse(request.postData() ?? "") as { eventName?: string })
          .eventName;
        if (eventName) playbackRequests.push(eventName);
      } catch {
        // The application deliberately treats analytics as best effort.
      }
    }
  });

  await page.route(
    (url) => url.pathname === "/media/audio/e2e-revolution",
    async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("playback") === "true") {
        mintCount += 1;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            url: `/media/audio/e2e-revolution?expires=${mintCount}&signature=e2e-${mintCount}`,
          }),
        });
        return;
      }
      if (failNextMediaRequest) {
        failNextMediaRequest = false;
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        headers: { "accept-ranges": "bytes" },
        body: fixtureBytes,
      });
    },
  );

  await page.goto("/");
  const card = page.locator(".media-card").filter({ hasText: revolutionTitle }).first();
  await card.getByRole("button", { name: `Play ${revolutionTitle}` }).click();

  const audio = page.getByLabel(`${revolutionTitle} audio player`);
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.paused))
    .toBe(false);
  await audio.evaluate((element: HTMLMediaElement) => {
    element.dataset.loadStartCount = "0";
    element.addEventListener("loadstart", () => {
      element.dataset.loadStartCount = String(Number(element.dataset.loadStartCount ?? "0") + 1);
    });
  });
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.currentTime))
    .toBeGreaterThanOrEqual(1);
  const beforeRefresh = await audio.evaluate((element: HTMLMediaElement) => ({
    currentSrc: element.currentSrc,
    currentTime: element.currentTime,
    loadStartCount: element.dataset.loadStartCount,
  }));
  await audio.evaluate((element: HTMLMediaElement) => {
    element.dataset.loaderRefreshProbe = "kept";
  });

  await card.getByRole("link", { name: "View track" }).click();
  await expect(page).toHaveURL(/\/tracks\/phase-zero-transmissions\/revolution-will-be-televised$/);
  await expect(audio).toHaveAttribute("data-loader-refresh-probe", "kept");
  await expect(audio).toHaveAttribute("data-load-start-count", beforeRefresh.loadStartCount!);
  expect(await audio.evaluate((element: HTMLMediaElement) => element.currentSrc)).toBe(
    beforeRefresh.currentSrc,
  );
  expect(
    await audio.evaluate((element: HTMLMediaElement) => element.currentTime),
  ).toBeGreaterThanOrEqual(beforeRefresh.currentTime);
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.paused))
    .toBe(false);
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.currentTime))
    .toBeGreaterThan(beforeRefresh.currentTime);
  const beforeSearchRefresh = await audio.evaluate((element: HTMLMediaElement) => ({
    currentSrc: element.currentSrc,
    currentTime: element.currentTime,
    loadStartCount: element.dataset.loadStartCount,
  }));

  await page
    .getByRole("navigation", { name: "Primary", exact: true })
    .getByRole("link", {
      name: "Search",
      exact: true,
    })
    .click();
  await page.getByLabel("Search artists, releases and tracks", { exact: true }).fill("Revolution");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=Revolution/);
  await expect(audio).toHaveAttribute("data-loader-refresh-probe", "kept");
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.currentSrc))
    .toBe(beforeSearchRefresh.currentSrc);
  await expect(audio).toHaveAttribute("data-load-start-count", beforeSearchRefresh.loadStartCount!);
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.paused))
    .toBe(false);
  expect(
    await audio.evaluate((element: HTMLMediaElement) => element.currentTime),
  ).toBeGreaterThanOrEqual(beforeSearchRefresh.currentTime);
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.currentTime))
    .toBeGreaterThan(beforeRefresh.currentTime);
  await expect(page.getByText("Loading media…")).toHaveCount(0);
  await expect
    .poll(() => playbackRequests.filter((name) => name === "play_requested"))
    .toHaveLength(1);
  expect(mintCount).toBe(1);
  expect(pageErrors).toEqual([]);

  await audio.evaluate((element: HTMLMediaElement) => element.pause());
  await expect.poll(() => audio.evaluate((element: HTMLMediaElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Play featured transmission" }).click();
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.paused))
    .toBe(false);
  await expect.poll(() => mintCount).toBe(2);

  failNextMediaRequest = true;
  await audio.evaluate((element: HTMLMediaElement) => element.pause());
  await page.getByRole("button", { name: "Play featured transmission" }).click();
  await expect(page.getByRole("alert")).toContainText(/could not be loaded|unavailable/);
  await page.getByRole("alert").getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => mintCount).toBe(4);
  await expect
    .poll(() => audio.evaluate((element: HTMLMediaElement) => element.paused))
    .toBe(false);
  await expect(page.getByText("Loading media…")).toHaveCount(0);
  await expect
    .poll(() => playbackRequests.filter((name) => name === "play_requested"))
    .toHaveLength(1);
});
