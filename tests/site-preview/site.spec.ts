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
  for (const path of ["/curator", "/curator.data", "/submit/example", "/media/example"]) {
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
