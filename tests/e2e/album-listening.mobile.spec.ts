import { expect, test } from "@playwright/test";
test("mobile album controls and both themes fit the viewport", async ({ page }) => {
  await page.goto("/releases/phase-zero-transmissions");
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    await expect(page.getByRole("button", { name: "Play album", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Queue album", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: /^Queue,/ })
    .click();
  await expect(page.locator(".queue")).toContainText("Phase Zero");
});
