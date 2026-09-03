import { expect, test } from "@playwright/test";

const themeStorageKey = "sunsyn-radio-theme-v1";

test.describe("SunSyn Radio theme", () => {
  test("uses the OS fallback and keeps the artist catalogue occurrence visible", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        browserErrors.push(`console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));

    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#faf8f4");
    await expect(page.getByRole("link", { name: "SunSyn Radio home" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Light mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const artistCard = page
      .locator(".media-card")
      .filter({ hasText: "Sunstruck Synapse (Revolution will be televised)" })
      .first();
    await expect(
      artistCard.getByText("Sunstruck Synapse (Revolution will be televised)", { exact: true }),
    ).toBeVisible();
    expect(browserErrors).toEqual([]);
  });

  test("saved preference overrides the OS fallback", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript((key) => window.localStorage.setItem(key, "dark"), themeStorageKey);
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Light mode" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("uses dark when the OS prefers dark and no preference is saved", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("link", { name: "SunSyn Radio home" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Light mode" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("persists a toggle across reload and internal navigation", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    await page.getByRole("button", { name: "Light mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Light mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), themeStorageKey))
      .toBe("light");

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Search" })
      .click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Light mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("keeps the persistent player and queue through a theme toggle", async ({ page }) => {
    const revolutionTitle = "Sunstruck Synapse (Revolution will be televised)";
    const revolutionSource = "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3";
    const mushroomTitle = "The Mushroom Circle (Gnome Revolution)";

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    const revolutionCard = page.locator(".media-card").filter({ hasText: revolutionTitle }).first();
    await revolutionCard.getByRole("button", { name: `Play ${revolutionTitle}` }).click();
    const mushroomCard = page.locator(".media-card").filter({ hasText: mushroomTitle }).first();
    await mushroomCard.getByRole("button", { name: `Queue ${mushroomTitle}` }).click();

    const audio = page.getByLabel(`${revolutionTitle} audio player`);
    await expect(audio.locator("source")).toHaveAttribute("src", revolutionSource);
    await audio.evaluate((element: HTMLMediaElement) => {
      element.dataset.themeTogglePersistenceProbe = "kept";
      element.pause();
    });

    const themeToggle = page.getByRole("button", { name: "Light mode" });
    await expect(themeToggle).toHaveAttribute("aria-pressed", "false");
    await themeToggle.click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(themeToggle).toHaveAttribute("aria-pressed", "true");
    const themedAudio = page.getByLabel(`${revolutionTitle} audio player`);
    await expect(themedAudio).toHaveAttribute("data-theme-toggle-persistence-probe", "kept");
    await expect(themedAudio.locator("source")).toHaveAttribute("src", revolutionSource);
    await expect(
      page.getByRole("heading", { name: `Sunstruck Synapse - ${revolutionTitle}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Play ${mushroomTitle} from queue` }),
    ).toBeVisible();
  });
});
