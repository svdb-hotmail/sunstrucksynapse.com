import { useEffect, useRef, useState } from "react";

import {
  applyTheme,
  DEFAULT_THEME,
  getDocumentTheme,
  parseTheme,
  persistTheme,
  readStoredTheme,
  readSystemTheme,
  THEME_ATTRIBUTE,
  THEME_CHANGE_EVENT,
  THEME_MEDIA_QUERY,
  type Theme,
} from "~/design-system/theme";

function findThemeTarget(button: HTMLButtonElement | null, document: Document): HTMLElement {
  return button?.closest<HTMLElement>(`[${THEME_ATTRIBUTE}]`) ?? document.documentElement;
}

function readThemeTarget(button: HTMLButtonElement | null, document: Document): Theme {
  const target = findThemeTarget(button, document);
  return parseTheme(target.getAttribute(THEME_ATTRIBUTE)) ?? getDocumentTheme(document);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const explicitSessionTheme = useRef<Theme | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const syncTheme = () => {
      setTheme(readThemeTarget(button.current, document));
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
      if (
        findThemeTarget(button.current, document) !== document.documentElement ||
        explicitSessionTheme.current
      ) {
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
    const themeTarget = findThemeTarget(button.current, document);
    if (themeTarget === document.documentElement) {
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
    } else {
      themeTarget.setAttribute(THEME_ATTRIBUTE, next);
    }
    setTheme(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <button
      ref={button}
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
