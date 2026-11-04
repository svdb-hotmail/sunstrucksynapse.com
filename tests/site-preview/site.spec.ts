import { expect, test } from "@playwright/test";

test("full site preview navigates, searches and keeps real playback across pages", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByText("Design preview · sample catalogue · production unchanged"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Human ears. New frequencies." })).toBeVisible();
  await page.getByRole("button", { name: "Play the selection", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > 0),
    )
    .toBe(true);
  await page.locator("audio").evaluate((audio) => {
    audio.dataset.previewContinuity = "kept";
  });
  await page
    .getByRole("navigation", { name: "Primary", exact: true })
    .getByRole("link", { name: "Explore", exact: true })
    .click();
  await page.getByRole("searchbox").fill("Mushroom");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".listener-track")).toHaveCount(1);
  await expect(page.locator("audio")).toHaveAttribute("data-preview-continuity", "kept");
  await page.locator(".media-card-title").click();
  await expect(
    page.getByRole("heading", { name: "The Mushroom Circle (Gnome Revolution)", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Phase Zero Transmissions", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Phase Zero Transmissions", exact: true }),
  ).toBeVisible();
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "Music chosen by people, made with intent." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("preview isolates private routes and mutations, and retains the component catalogue", async ({
  request,
}) => {
  for (const path of [
    "/curator/api/uploads",
    "/curator/review-audio/private-id",
    "/submit/example",
    "/media/example",
  ]) {
    expect(
      (
        await request.get(path, {
          headers: { "x-test-curator-identity": "actor|curator@example.test" },
        })
      ).status(),
    ).toBe(404);
  }
  expect((await request.post("/curator", { form: { intent: "publish" } })).status()).toBe(405);
  expect((await request.post("/api/events", { data: {} })).status()).toBe(204);
  expect((await request.get("/")).headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  expect((await request.get("/storybook/index.json")).status()).toBe(200);
});

test("curator preview exposes real workspace components with browser-only sample interactions", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/curator");
  await expect(page.getByRole("heading", { name: "Catalogue", exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Curator", exact: true })
    .getByRole("link", { name: "Review submissions", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Submission queue", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review next ready submission →", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review & scoring", exact: true })).toBeVisible();
  for (let index = 0; index < 4; index++)
    await page
      .locator(".curator-score-list fieldset")
      .nth(index)
      .locator('input[value="4"]')
      .check();
  await page.locator('input[name="grade"][value="B"]').check();
  await page.getByLabel("Decision rationale").fill("A sample review for checking the design.");
  await page.getByRole("button", { name: /^Finish & next/ }).click();
  await expect(page.getByText("Preview only: no review decision was recorded.")).toBeVisible();
  await page.getByRole("link", { name: "Edit sample metadata", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit sample submission", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Curator", exact: true })
    .getByRole("link", { name: "Release preparation", exact: true })
    .click();
  await page.getByRole("button", { name: "Show ready state", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Night Signals", exact: true, level: 1 }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Publish album", exact: true }).click();
  await expect(page.getByText("Preview only: no release was published.")).toBeVisible();
  expect((await request.post("/curator/submissions", { form: { intent: "grade" } })).status()).toBe(
    405,
  );
  expect(errors).toEqual([]);
});
