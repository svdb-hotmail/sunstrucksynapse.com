import { useEffect, useRef, useState } from "react";

import {
  applyTheme,
  DEFAULT_THEME,
  getDocumentTheme,
  persistTheme,
  readStoredTheme,
  readSystemTheme,
  THEME_CHANGE_EVENT,
  THEME_MEDIA_QUERY,
  type Theme,
} from "~/design-system/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const explicitSessionTheme = useRef<Theme | null>(null);

  useEffect(() => {
    const syncTheme = () => {
      setTheme(getDocumentTheme(document));
    };

    // The pre-paint script has already selected the theme by the time this runs.
    syncTheme();

    const mediaQuery = (() => {
      try {
        return window.matchMedia(THEME_MEDIA_QUERY);
      } catch {
        return null;
      }
    })();
    const onSystemThemeChange = () => {
      if (explicitSessionTheme.current) {
        return;
      }

      let storageTheme: Theme | null = null;
      try {
        storageTheme = readStoredTheme(window.localStorage);
      } catch {
        // A blocked localStorage behaves like no saved preference.
      }
      if (!storageTheme) {
        const systemTheme = readSystemTheme((query) => window.matchMedia(query));
        if (systemTheme) {
          applyTheme(systemTheme, document);
          setTheme(systemTheme);
        }
      }
    };
    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", onSystemThemeChange);
      } else {
        mediaQuery.addListener(onSystemThemeChange);
      }
    }
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);

    return () => {
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", onSystemThemeChange);
        } else {
          mediaQuery.removeListener(onSystemThemeChange);
        }
      }
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
    };
  }, []);

  const title = theme === "dark" ? "Enable light mode" : "Disable light mode";

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    explicitSessionTheme.current = next;
    applyTheme(next, document);
    persistTheme(
      (() => {
        try {
          return window.localStorage;
        } catch {
          return null;
        }
      })(),
      next,
    );
    setTheme(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Light mode"
      aria-pressed={theme === "light"}
      title={title}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        ☼
      </span>
      <span className="theme-toggle__label">Light mode</span>
    </button>
  );
}
