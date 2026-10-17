import { expect, test, type Locator } from "@playwright/test";

async function expectSingleRow(nav: Locator) {
  const links = nav.locator("a,button");
  const bounds = await links.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
    }),
  );
  expect(
    Math.max(...bounds.map((rect) => rect.top)) - Math.min(...bounds.map((rect) => rect.top)),
  ).toBeLessThan(2);
  for (const link of await links.all()) await expect(link).toBeInViewport();
}

test("sparse mobile navigation keeps Listen, Explore and Queue accessible in one row", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-test-catalogue-scenario": "sparse-r2" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/submission-terms");
  const nav = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["Listen", "Explore"]);
  await expectSingleRow(nav);
  await nav.getByRole("link", { name: "Listen", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Start listening.", exact: true }),
  ).toBeInViewport();
  await expect(page.locator("#catalogue .media-card")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /stillith.*tracks/i })).toBeVisible();
  await expect(page.locator("#latest, #audio, #video")).toHaveCount(0);
  await nav.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeVisible();
  const about = page.getByRole("link", { name: "About SunSyn", exact: true });
  await expect(about).toHaveAttribute("href", "/about");
  await about.click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Music chosen by people, made with intent." }),
  ).toBeVisible();
  await expect(page.locator(".offerings")).toBeVisible();
  await expect(page.locator(".offer-grid article")).toHaveCount(3);
  await expect(page.locator(".contact-launch")).toBeVisible();
  await expect(page.getByRole("region", { name: "Policy questions" })).toBeVisible();
  await expect(page.locator(".panel-footer")).toHaveCount(0);
  const policyFaq = page.getByRole("region", { name: "Policy questions" });
  for (const [question, label, href, heading] of [
    [
      "How is personal information handled?",
      "Read the privacy notice",
      "/privacy",
      "Privacy notice",
    ],
    [
      "What should I know before submitting work?",
      "Read the submission terms",
      "/submission-terms",
      "Submission terms",
    ],
    [
      "How do I report a rights concern?",
      "Read the takedown process",
      "/takedown",
      "Content takedown process",
    ],
  ] as const) {
    await policyFaq.getByText(question, { exact: true }).click();
    const link = policyFaq.getByRole("link", { name: label, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await page.goto("/about");
  }
  await expectSingleRow(nav);
});

test("three phone destinations fit and remain usable with standard collections", async ({
  page,
}) => {
  await page.goto("/search");
  const nav = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["Listen", "Explore"]);
  await expectSingleRow(nav);
  await nav.getByRole("link", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Start listening.", exact: true }),
  ).toBeInViewport();
  await nav.getByRole("button", { name: "Queue, 0 tracks", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Your queue" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nav.getByRole("button", { name: "Queue, 0 tracks", exact: true })).toBeFocused();
  await nav.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeInViewport();
  await expectSingleRow(nav);
});
