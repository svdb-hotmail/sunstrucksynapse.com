import { expect, test } from "@playwright/test";

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
