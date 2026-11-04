import { expect, test, type Locator } from "@playwright/test";

for (const theme of ["dark", "light"] as const) {
  test(`SDP-2 ${theme} keeps listening controls readable and reachable at desktop and phone widths`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("sunsyn-radio-theme-v1", value),
      theme,
    );
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page.getByRole("button", { name: "Start listening", exact: true }),
      ).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const contrast = await page
        .locator(".listener-primary")
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          function luminance(color: string) {
            const channels = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((value) => {
                const channel = value / 255;
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
              });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          }
          const text = luminance(style.color),
            background = luminance(style.backgroundColor);
          return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
        });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      await page.getByRole("button", { name: "Start listening", exact: true }).focus();
      const focus = await page.locator(".listener-primary").evaluate((element) => {
        const style = getComputedStyle(element);
        return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
      });
      expect(focus.width).toBeGreaterThanOrEqual(2);
      expect(focus.style).toBe("solid");
    }
  });
}

// Use actual computed colors, composited over ancestors, rather than token strings.
async function contrastOf(locator: Locator, foreground: "color" | "borderTopColor") {
  return locator.evaluate((element, property) => {
    function parse(color: string) {
      const values = color.match(/[\d.]+/g)!.map(Number);
      return [values[0], values[1], values[2], values[3] ?? 1];
    }
    function over(front: number[], back: number[]) {
      return front
        .slice(0, 3)
        .map((value, index) => value * front[3] + back[index] * (1 - front[3]))
        .concat(1);
    }
    function background(node: Element | null): number[] {
      return node
        ? over(parse(getComputedStyle(node).backgroundColor), background(node.parentElement))
        : [255, 255, 255, 1];
    }
    function luminance(color: number[]) {
      const c = color.slice(0, 3).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    }
    const bg = background(element);
    const a = luminance(over(parse(getComputedStyle(element)[property]), bg)),
      b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, foreground);
}

for (const theme of ["dark", "light"] as const) {
  test(`SDP-2 ${theme} preserves dock hover and unfocused field contrast`, async ({ page }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("sunsyn-radio-theme-v1", value),
      theme,
    );
    await page.goto("/");
    const dockPlay = page.locator(".transport .dock-play");
    await dockPlay.hover();
    expect(await contrastOf(dockPlay, "color")).toBeGreaterThanOrEqual(3);
    await page.getByRole("button", { name: "Start listening", exact: true }).click();
    await page.getByRole("button", { name: /^Open player:/ }).click();
    const fullPlay = page.locator(".player-transport .dock-play");
    await fullPlay.hover();
    expect(await contrastOf(fullPlay, "color")).toBeGreaterThanOrEqual(3);
    await page.getByRole("button", { name: "Close listening panel", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Primary", exact: true })
      .getByRole("link", { name: "Explore", exact: true })
      .click();
    const field = page.getByRole("searchbox");
    await expect(field).toBeVisible();
    expect(await contrastOf(field, "borderTopColor")).toBeGreaterThanOrEqual(3);
  });
}
