import { expect, test } from "@playwright/test";

test("renders the radio copy and updates the featured selection", async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: "Listen", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Watch", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "About the radio", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sunstruck Synapse - Solar Nerve" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Select Morning Voltage" }).click();

  await expect(
    page.getByRole("heading", { name: "Sunstruck Synapse - Morning Voltage" }),
  ).toBeVisible();
  await expect(page.getByText("Preview coming soon.").first()).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("queues unique items in order, consumes an entry, and clears the queue", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Queue Solar Nerve" }).click();
  await page.getByRole("button", { name: "Queue Solar Nerve" }).click();
  await page.getByRole("button", { name: "Queue Signal Bloom" }).click();
  await expect(
    page.getByRole("heading", { name: "Sunstruck Synapse - Solar Nerve" }),
  ).toBeVisible();

  const queue = page.getByRole("heading", { name: "Next in queue" }).locator("..").locator("..");
  await expect(queue.getByRole("listitem")).toHaveCount(2);
  await expect(queue.getByRole("listitem").nth(0)).toContainText("Solar Nerve");
  await expect(queue.getByRole("listitem").nth(1)).toContainText("Signal Bloom");

  await queue.getByRole("button", { name: "Play Solar Nerve from queue" }).click();
  await expect(queue.getByRole("listitem")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Sunstruck Synapse - Solar Nerve" }),
  ).toBeVisible();

  await queue.getByRole("button", { name: "Clear all" }).click();
  await expect(queue.getByText("Queue is clear.")).toBeVisible();
});
