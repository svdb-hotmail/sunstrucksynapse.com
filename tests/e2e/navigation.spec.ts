import { expect, test } from "@playwright/test";

test("desktop navigation reaches Home, Explore, and About without duplicate subpage footers", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["Home", "Explore", "About"]);
  await expect(page.locator(".site-footer")).toHaveCount(0);

  await nav.getByRole("link", { name: "Explore" }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
  await expect(page.locator(".site-footer")).toHaveCount(0);

  await nav.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 1, name: "Music chosen by people, made with intent." }),
  ).toBeVisible();
  await expect(page.locator(".site-footer")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Policy questions" })).toBeVisible();
  for (const [question, label, path, heading] of [
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
    await page.getByText(question, { exact: true }).click();
    await page.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await nav.getByRole("link", { name: "About" }).click();
  }
  await page.getByRole("button", { name: "Contact SunSyn" }).click();
  await expect(page.getByRole("dialog", { name: "Send the signal." })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog", { name: "Send the signal." })).toBeHidden();

  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".site-footer")).toHaveCount(0);
});
