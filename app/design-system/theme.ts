export type Theme = "light" | "dark";

export const DEFAULT_THEME: Theme = "dark";
export const THEME_STORAGE_KEY = "sunsyn-radio-theme-v1";
export const THEME_ATTRIBUTE = "data-theme";
export const THEME_CHANGE_EVENT = "sunsyn-theme-change";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: light)";

/** Keep these values in sync with the design-system surface tokens. */
export const THEME_COLORS: Record<Theme, string> = {
  light: "#f1e7d4",
  dark: "#080b0b",
};

export type ThemeStorage = Pick<Storage, "getItem" | "setItem">;
export type MatchMedia = (query: string) => MediaQueryList;

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function parseTheme(value: unknown): Theme | null {
  return isTheme(value) ? value : null;
}

/** Resolve the explicit preference, then system preference, then the stable fallback. */
export function resolveTheme(
  savedTheme: unknown,
  systemTheme: unknown,
  fallback: Theme = DEFAULT_THEME,
): Theme {
  return parseTheme(savedTheme) ?? parseTheme(systemTheme) ?? fallback;
}

export function readStoredTheme(storage: ThemeStorage | null | undefined): Theme | null {
  if (!storage) {
    return null;
  }

  try {
    return parseTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function readSystemTheme(matchMedia: MatchMedia | null | undefined): Theme | null {
  if (!matchMedia) {
    return null;
  }

  try {
    return matchMedia(THEME_MEDIA_QUERY).matches ? "light" : "dark";
  } catch {
    return null;
  }
}

export function getInitialTheme(
  storage: ThemeStorage | null | undefined = null,
  matchMedia: MatchMedia | null | undefined = null,
): Theme {
  return resolveTheme(readStoredTheme(storage), readSystemTheme(matchMedia));
}

export function getDocumentTheme(document: Document | null | undefined): Theme {
  return parseTheme(document?.documentElement.getAttribute(THEME_ATTRIBUTE)) ?? DEFAULT_THEME;
}

export function persistTheme(storage: ThemeStorage | null | undefined, theme: Theme): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function updateThemeColor(document: Document, theme: Theme): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  meta?.setAttribute("content", THEME_COLORS[theme]);
}

export function applyTheme(theme: Theme, document: Document): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  updateThemeColor(document, theme);
}

/**
 * This is deliberately a static script string. Its only interpolated values are JSON-encoded
 * compile-time constants, so it can run before React and cannot execute user-provided content.
 */
export const THEME_INIT_SCRIPT = `(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const mediaQuery = ${JSON.stringify(THEME_MEDIA_QUERY)};
  const fallback = ${JSON.stringify(DEFAULT_THEME)};
  const colors = ${JSON.stringify(THEME_COLORS)};
  let saved = null;
  try {
    saved = window.localStorage.getItem(storageKey);
  } catch {}
  let theme = saved === "light" || saved === "dark" ? saved : null;
  if (!theme) {
    try {
      theme = window.matchMedia(mediaQuery).matches ? "light" : "dark";
    } catch {}
  }
  theme = theme || fallback;
  document.documentElement.setAttribute("${THEME_ATTRIBUTE}", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", colors[theme]);
})();`;
