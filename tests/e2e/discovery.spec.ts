import { expect, test } from "@playwright/test";

test("searches and filters the published catalogue with URL-backed controls", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: "Search the collection" })).toBeVisible();
  await expect(page.locator(".entity-track-list > li")).toHaveCount(6);

  await page.getByLabel("Genre").selectOption("folk");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/genre=folk/);
  await expect(page.locator(".entity-track-list > li")).toHaveCount(1);
  await expect(page.getByText("The Mushroom Circle (Gnome Revolution)")).toBeVisible();

  await page.getByRole("link", { name: "Clear filters" }).click();
  await page.getByLabel("Search artists, releases and tracks").fill("Gone Fishing");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.locator(".entity-track-list > li")).toHaveCount(1);
  await expect(page.getByText("1 matching track.")).toBeVisible();

  await page.getByLabel("Mood").selectOption("energetic");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/No matching tracks/)).toBeVisible();
});

test("accepts anonymous events, rejects malformed payloads, and protects analytics", async ({
  request,
}) => {
  const event = {
    eventId: crypto.randomUUID(),
    eventName: "playback_started",
    anonymousSessionId: crypto.randomUUID(),
    trackId: "30000000-0000-4000-8000-000000000101",
    occurredAt: new Date().toISOString(),
  };
  expect((await request.post("/api/events", { data: event })).status()).toBe(202);
  expect((await request.post("/api/events", { data: event })).status()).toBe(202);
  expect((await request.post("/api/events", { data: { eventName: "unknown" } })).status()).toBe(
    400,
  );
  expect((await request.get("/curator/analytics")).status()).toBe(401);
  const analytics = await request.get("/curator/analytics", {
    headers: { "x-test-curator-identity": "playwright-actor|CURATOR@EXAMPLE.TEST" },
  });
  expect(analytics.status()).toBe(200);
  expect(await analytics.text()).toContain("Catalogue analytics");
});
