import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  getInitialTheme,
  parseTheme,
  persistTheme,
  readStoredTheme,
  readSystemTheme,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "../../app/design-system/theme";

describe("SunSyn theme preference", () => {
  it("prioritizes a valid saved preference over the OS preference", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("ignores invalid preferences before falling back to the OS and then dark", () => {
    expect(parseTheme("sepia")).toBeNull();
    expect(resolveTheme("sepia", "light")).toBe("light");
    expect(resolveTheme("sepia", "sepia")).toBe(DEFAULT_THEME);
    expect(resolveTheme(null, null)).toBe(DEFAULT_THEME);
  });

  it("tolerates unavailable storage and matchMedia", () => {
    const unavailableStorage = {
      getItem() {
        throw new Error("storage blocked");
      },
      setItem() {
        throw new Error("storage blocked");
      },
    };
    const unavailableMatchMedia = () => {
      throw new Error("matchMedia blocked");
    };

    expect(readStoredTheme(unavailableStorage)).toBeNull();
    expect(readSystemTheme(unavailableMatchMedia)).toBeNull();
    expect(getInitialTheme(unavailableStorage, unavailableMatchMedia)).toBe(DEFAULT_THEME);
    expect(persistTheme(unavailableStorage, "light")).toBe(false);
  });

  it("uses the dedicated key and a deterministic pre-paint initializer", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };

    expect(persistTheme(storage, "light")).toBe(true);
    expect(values.get(THEME_STORAGE_KEY)).toBe("light");
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_INIT_SCRIPT).toContain("prefers-color-scheme");
  });
});
