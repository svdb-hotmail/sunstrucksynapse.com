import { Link, useLocation } from "react-router";
import { SITE_NAME } from "~/config/brand";
import { ThemeToggle } from "~/design-system/ThemeToggle";
import { StationMark } from "~/design-system/StationMark";
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
  const { pathname } = useLocation();
  return (
    <header className="topbar masthead brand-topbar">
      <div className="brand-lockup">
        <Link className="site-logo wordmark" to="/" aria-label={`${SITE_NAME} home`}>
          <span className="mini-orb station-mark brand-icon-badge" aria-hidden="true">
            <StationMark />
          </span>
          <span className="site-wordmark brand-display brand-gradient-text">
            SUNSYN<span className="wordmark-radio">RADIO</span>
          </span>
        </Link>
      </div>
      <nav className="desktop-nav" aria-label="Primary">
        {navigation.map((entry) => (
          <Link
            key={entry.to}
            to={entry.to}
            aria-current={isCatalogueNavigationEntryActive(entry, pathname) ? "page" : undefined}
          >
            {entry.label}
          </Link>
        ))}
        <Link to="/about" aria-current={pathname === "/about" ? "page" : undefined}>
          About
        </Link>
      </nav>
      <div className="topbar-actions preview-label">
        {import.meta.env.MODE === "site-preview" ? (
          <>
            Design preview <ThemeToggle />
          </>
        ) : (
          <ThemeToggle />
        )}
      </div>
    </header>
  );
}
