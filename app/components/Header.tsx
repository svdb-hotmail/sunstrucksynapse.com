import { Link, useLocation } from "react-router";

import { SITE_NAME } from "~/config/brand";
import { ThemeToggle } from "~/design-system/ThemeToggle";
import {
  defaultCatalogueNavigation,
  isCatalogueNavigationEntryActive,
  type CatalogueNavigationEntry,
} from "~/services/catalogue";

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
          <span className="site-wordmark">Sunstruck Synapse</span>
        </Link>
        <p className="brand-caption">Human-curated music with intent</p>
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
      </div>
    </header>
  );
}
