import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.setTimeout(120_000);

function section(page: Page, heading: string) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: heading, exact: true }),
  });
}

test("keeps public routes available while curator mutations require Access", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Sunstruck Synapse/);

  const curator = await request.get("/curator");
  expect(curator.status()).toBe(401);
  expect(await curator.text()).toContain("Authentication required.");

  const mutation = await request.post("/curator", {
    form: {
      intent: "create",
      entityType: "artist",
      title: "Unauthorized Artist",
      slug: "unauthorized-artist",
    },
  });
  expect(mutation.status()).toBe(401);
});

test("manages linked catalogue records and surfaces safe form failures", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-test-curator-identity": "playwright-actor|CURATOR@EXAMPLE.TEST",
    },
  });
  const page = await context.newPage();
  const suffix = `${Date.now()}-${testInfo.retry}`;
  const artistSlug = `artist-${suffix}`;
  const releaseSlug = `release-${suffix}`;
  const trackSlug = `track-${suffix}`;

  await page.goto("/curator");
  await expect(page.getByText("Signed in as curator@example.test")).toBeVisible();

  const artistSection = section(page, "Artist management");
  await artistSection.getByLabel("Title").first().fill("Integration Artist");
  await artistSection.getByLabel("Slug").first().fill(artistSlug);
  await artistSection.getByRole("button", { name: "Create artist" }).click();
  await expect(
    artistSection.locator(".curator-record").filter({
      has: page.locator('input[name="title"][value="Integration Artist"]'),
    }),
  ).toBeVisible();

  await artistSection.getByLabel("Title").first().fill("Duplicate Artist");
  await artistSection.getByLabel("Slug").first().fill(artistSlug);
  await artistSection.getByRole("button", { name: "Create artist" }).click();
  await expect(page.locator('.curator-workspace [role="alert"]')).toContainText(
    "artist slug is already in use",
  );

  const releaseSection = section(page, "Release management");
  await releaseSection.getByLabel("Title").first().fill("Integration Release");
  await releaseSection.getByLabel("Slug").first().fill(releaseSlug);
  await releaseSection
    .getByLabel("Primary artist")
    .first()
    .selectOption({ label: "Integration Artist" });
  await releaseSection.getByRole("button", { name: "Create release" }).click();

  const trackSection = section(page, "Track management");
  await trackSection.getByLabel("Title").first().fill("Integration Track");
  await trackSection.getByLabel("Slug").first().fill(trackSlug);
  await trackSection
    .getByLabel("Primary artist")
    .first()
    .selectOption({ label: "Integration Artist" });
  await trackSection.getByLabel("Release").first().selectOption({ label: "Integration Release" });
  await trackSection.getByLabel("Position").fill("1");
  await trackSection.getByRole("button", { name: "Create track" }).click();
  await expect(
    trackSection.locator(".curator-record").filter({
      has: page.locator('input[name="title"][value="Integration Track"]'),
    }),
  ).toBeVisible();

  const artistRecord = artistSection.locator(".curator-record").filter({
    has: page.locator('input[name="title"][value="Integration Artist"]'),
  });
  await artistRecord.getByLabel("Title").fill("Edited Integration Artist");
  await artistRecord.getByRole("button", { name: "Save" }).click();
  await expect(
    artistSection.locator('input[name="title"][value="Edited Integration Artist"]'),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await artistSection
    .locator(".curator-record")
    .filter({
      has: page.locator('input[name="title"][value="Edited Integration Artist"]'),
    })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.locator('.curator-workspace [role="alert"]')).toContainText(
    "Remove this artist's release and track credits",
  );
  await context.close();
});

test("orders multi-collection tracks and exposes auditable scheduled publication", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-test-curator-identity": "audit-actor|auditor@example.test",
    },
  });
  const page = await context.newPage();
  const suffix = `${Date.now()}-${testInfo.retry}`;
  const artistSection = section(page, "Artist management");
  const releaseSection = section(page, "Release management");
  const trackSection = section(page, "Track management");
  const collectionSection = section(page, "Collection management");

  await page.goto("/curator");
  await artistSection.getByLabel("Title").first().fill("Ordering Artist");
  await artistSection.getByLabel("Slug").first().fill(`ordering-artist-${suffix}`);
  await artistSection.getByRole("button", { name: "Create artist" }).click();
  await releaseSection.getByLabel("Title").first().fill("Ordering Release");
  await releaseSection.getByLabel("Slug").first().fill(`ordering-release-${suffix}`);
  await releaseSection.getByLabel("Primary artist").first().selectOption({
    label: "Ordering Artist",
  });
  await releaseSection.getByRole("button", { name: "Create release" }).click();
  await trackSection.getByLabel("Title").first().fill("Ordering Track");
  await trackSection.getByLabel("Slug").first().fill(`ordering-track-${suffix}`);
  await trackSection.getByLabel("Primary artist").first().selectOption({
    label: "Ordering Artist",
  });
  await trackSection.getByLabel("Release").first().selectOption({
    label: "Ordering Release",
  });
  await trackSection.getByLabel("Position").fill("1");
  await trackSection.getByRole("button", { name: "Create track" }).click();

  for (const [title, slug] of [
    ["Integration Shelf One", `shelf-one-${suffix}`],
    ["Integration Shelf Two", `shelf-two-${suffix}`],
  ]) {
    await collectionSection.getByLabel("Title").first().fill(title);
    await collectionSection.getByLabel("Slug").first().fill(slug);
    await collectionSection.getByRole("button", { name: "Create collection" }).click();
  }

  const shelves = section(page, "Editorial shelves");
  for (const title of ["Integration Shelf One", "Integration Shelf Two"]) {
    const shelf = shelves.locator(".curator-record").filter({ hasText: title });
    await shelf.getByLabel("Add track").selectOption({ label: "Ordering Track" });
    await shelf.getByRole("button", { name: "Add track" }).click();
    await expect(shelf.getByRole("listitem")).toContainText("Ordering Track");
  }

  const collectionRecord = collectionSection.locator(".curator-record").filter({
    has: page.locator('input[name="title"][value="Integration Shelf One"]'),
  });
  await collectionRecord.getByRole("button", { name: "Move to in review" }).click();
  await expect(collectionRecord.getByText("in_review", { exact: true })).toBeVisible();
  await collectionRecord.getByLabel("Schedule time").fill("2030-01-01T00:00");
  await collectionRecord.getByRole("button", { name: "Move to scheduled" }).click();
  await expect(collectionRecord.getByText("scheduled", { exact: true })).toBeVisible();
  await collectionRecord.getByLabel("published reason").fill("Editorial approval");
  await collectionRecord.getByRole("button", { name: "Move to published" }).click();
  await collectionRecord.getByLabel("archived reason").fill("Shelf retired");
  await collectionRecord.getByRole("button", { name: "Move to archived" }).click();
  await expect(collectionRecord.getByText("archived", { exact: true })).toBeVisible();

  const audit = section(page, "Publication operations");
  await expect(audit.getByRole("cell", { name: "auditor@example.test" }).first()).toBeVisible();
  await expect(audit.getByRole("cell", { name: "Editorial approval" })).toBeVisible();
  await expect(audit.getByRole("cell", { name: "Shelf retired" })).toBeVisible();
  await context.close();
});
