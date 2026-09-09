import { Link, useLocation } from "react-router";

import { SITE_NAME, SITE_URL } from "~/config/brand";
import { ThemeToggle } from "~/design-system/ThemeToggle";
import {
  defaultCatalogueNavigation,
  isCatalogueNavigationEntryActive,
  type CatalogueNavigationEntry,
} from "~/services/catalogue";

const SITE_HOSTNAME = new URL(SITE_URL).hostname.replace(/^www\./, "");

export function Header({
  navigation = defaultCatalogueNavigation,
}: {
  navigation?: CatalogueNavigationEntry[];
}) {
  const { pathname, hash } = useLocation();

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <Link className="site-logo" to="/" aria-label={`${SITE_NAME} home`}>
          <span className="mini-orb" aria-hidden="true">
            ☼
          </span>
          <span className="site-wordmark">{SITE_HOSTNAME}</span>
        </Link>
        <h2>A radio for music made with intent.</h2>
      </div>

      <nav className="desktop-nav" aria-label="Primary">
        {navigation.map((entry, index) => (
          <Link
            key={entry.to}
            to={entry.to}
            aria-current={
              isCatalogueNavigationEntryActive(entry, pathname, hash, index === 0)
                ? entry.to.startsWith("/#")
                  ? "location"
                  : "page"
                : undefined
            }
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <div className="topbar-actions">
        <ThemeToggle />
        <Link className="subscribe" to="/submission-terms">
          <span aria-hidden="true">◆</span> Submission terms <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
