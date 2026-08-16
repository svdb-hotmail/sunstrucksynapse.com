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
  await expect(page.getByRole("heading", { name: /Revolution will be televised/ })).toBeVisible();

  await page.getByRole("button", { name: "Select The Mushroom Circle (Gnome Revolution)" }).click();

  const audio = page.getByLabel("The Mushroom Circle (Gnome Revolution) audio player");
  await expect(audio).toBeVisible();
  await expect(audio.locator("source")).toHaveAttribute(
    "src",
    "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3",
  );
  await expect(audio.locator("source")).toHaveAttribute("type", "audio/mpeg");
  await expect(page.getByText("Preview coming soon.").first()).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("queues unique items in order, consumes an entry, and clears the queue", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("button", {
      name: "Queue Sunstruck Synapse (Revolution will be televised)",
    })
    .click();
  await page
    .getByRole("button", {
      name: "Queue Sunstruck Synapse (Revolution will be televised)",
    })
    .click();
  await page.getByRole("button", { name: "Queue AI Pop-Slop 202607190035" }).click();
  await expect(page.getByRole("heading", { name: /Revolution will be televised/ })).toBeVisible();

  const queue = page.getByRole("heading", { name: "Next in queue" }).locator("..").locator("..");
  await expect(queue.getByRole("listitem")).toHaveCount(2);
  await expect(queue.getByRole("listitem").nth(0)).toContainText("Revolution will be televised");
  await expect(queue.getByRole("listitem").nth(1)).toContainText("AI Pop-Slop 202607190035");

  await queue
    .getByRole("button", {
      name: "Play Sunstruck Synapse (Revolution will be televised) from queue",
    })
    .click();
  await expect(queue.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /Revolution will be televised/ })).toBeVisible();

  await queue.getByRole("button", { name: "Clear all" }).click();
  await expect(queue.getByText("Queue is clear.")).toBeVisible();
});

test("play switches real audio and video sources without stale media", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("button", { name: "Play Sunstruck Synapse (Revolution will be televised)" })
    .click();
  const firstAudio = page.getByLabel(
    "Sunstruck Synapse (Revolution will be televised) audio player",
  );
  await expect(firstAudio.locator("source")).toHaveAttribute(
    "src",
    "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
  );
  await expect
    .poll(() => firstAudio.evaluate((element: { readyState: number }) => element.readyState))
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Play AI Pop-Slop 202607190035" }).click();
  const video = page.getByLabel("AI Pop-Slop 202607190035 video player");
  await expect(video.locator("source")).toHaveAttribute(
    "src",
    "/assets/video/AI_pop-slop_202607190035.mp4",
  );
  const videoResponse = await page.request.get("/assets/video/AI_pop-slop_202607190035.mp4");
  expect(videoResponse.ok()).toBe(true);
  expect(videoResponse.headers()["content-type"]).toContain("video/mp4");
  await expect(page.locator("audio.protected-media")).toHaveCount(0);

  await page.getByRole("button", { name: "Play The Mushroom Circle (Gnome Revolution)" }).click();
  const secondAudio = page.getByLabel("The Mushroom Circle (Gnome Revolution) audio player");
  await expect(secondAudio.locator("source")).toHaveAttribute(
    "src",
    "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3",
  );
  await expect
    .poll(() => secondAudio.evaluate((element: { readyState: number }) => element.readyState))
    .toBeGreaterThan(0);
  await expect(page.locator("video.protected-media")).toHaveCount(0);
});
