import { expect, test } from "@playwright/test";

test("renders the home page and updates the featured player", async ({ page }) => {
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
    page.getByRole("heading", { name: "Sunstruck Synapse - Solar Nerve" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Select Morning Voltage" }).click();

  await expect(
    page.getByRole("heading", { name: "Sunstruck Synapse - Morning Voltage" }),
  ).toBeVisible();
  await expect(page.getByLabel("Morning Voltage audio player")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
