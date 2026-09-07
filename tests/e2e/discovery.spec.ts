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
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByLabel("Search artists, releases and tracks")).toHaveValue("");
  await page.getByLabel("Search artists, releases and tracks").fill("Gone Fishing");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=Gone(?:\+|%20)Fishing/);
  await expect(page.locator(".entity-track-list > li")).toHaveCount(1);
  await expect(page.getByText("1 matching track.")).toBeVisible();

  await page.getByLabel("Mood").selectOption("energetic");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/No matching tracks/)).toBeVisible();
});

test("explains unavailable sparse-catalogue facets without blocking text search", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "sparse-r2" });
  await page.goto("/search");
  for (const label of ["Genre", "Mood", "Year", "Creative process"]) {
    const select = page.getByRole("combobox", { name: label, exact: true });
    await expect(select).toBeDisabled();
    await expect(select.locator("option")).toHaveCount(1);
    await expect(select).toHaveAccessibleDescription(
      `No ${label.toLowerCase()} values are available for published tracks.`,
    );
    const helpId = await select.getAttribute("aria-describedby");
    expect(helpId).toBeTruthy();
    await expect(
      page.locator("p").filter({
        hasText: `No ${label.toLowerCase()} values are available for published tracks.`,
      }),
    ).toBeVisible();
  }
  await page.getByLabel("Search artists, releases and tracks", { exact: true }).fill("Revolution");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=Revolution/);
  await expect(page.locator(".entity-track-list > li")).toHaveCount(1);
  await page.getByRole("link", { name: "Clear filters", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
});

for (const sparse of [false, true]) {
  test(`preserves unknown URL filters through submission and reset (${sparse ? "sparse" : "standard"} catalogue)`, async ({
    page,
  }) => {
    if (sparse) await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "sparse-r2" });
    const selected = {
      genre: "unknown-genre",
      mood: "unknown-mood",
      year: "1901",
      process: "unknown-process",
    };
    const params = new URLSearchParams({ q: "Revolution", ...selected });
    await page.goto(`/search?${params}`);
    for (const [name, value] of Object.entries(selected)) {
      const select = page.locator(`select[name="${name}"]`);
      await expect(select).toBeEnabled();
      await expect(select).toHaveValue(value);
      await expect(select.locator(`option[value="${value}"]`)).toHaveText(`${value} (unavailable)`);
      await expect(select).toHaveAccessibleDescription(/The selected value is not available/);
    }
    await expect(page.getByText(/No matching tracks/)).toBeVisible();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect
      .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
      .toEqual({ q: "Revolution", ...selected });
    for (const [name, value] of Object.entries(selected))
      await expect(page.locator(`select[name="${name}"]`)).toHaveValue(value);
    for (const name of Object.keys(selected))
      await page.locator(`select[name="${name}"]`).selectOption("");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByLabel("Search artists, releases and tracks", { exact: true }),
    ).toHaveValue("Revolution");
    await expect(page.getByText(/No matching tracks/)).toHaveCount(0);
    for (const name of Object.keys(selected))
      await expect(page.locator(`select[name="${name}"]`)).toHaveValue("");
    await page.getByRole("link", { name: "Clear filters", exact: true }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(
      page.getByLabel("Search artists, releases and tracks", { exact: true }),
    ).toHaveValue("");
    for (const name of Object.keys(selected)) {
      const select = page.locator(`select[name="${name}"]`);
      if (sparse) await expect(select).toBeDisabled();
      else await expect(select).toBeEnabled();
    }
  });
}

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

test("publishes privacy, submission, and takedown policies", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
  await page.goto("/submission-terms");
  await expect(page.getByRole("heading", { name: "Submission terms" })).toBeVisible();
  await page.goto("/takedown");
  await expect(page.getByRole("heading", { name: "Content takedown process" })).toBeVisible();
});
