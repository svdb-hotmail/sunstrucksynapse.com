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
  queueCount = 0,
  onOpenQueue,
}: {
  navigation?: CatalogueNavigationEntry[];
  queueCount?: number;
  onOpenQueue?: () => void;
}) {
  const { pathname } = useLocation();
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <Link className="site-logo" to="/" aria-label={`${SITE_NAME} home`}>
          <span className="mini-orb" aria-hidden="true">
            ☼
          </span>
          <span className="site-wordmark">{SITE_NAME}</span>
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
        <button
          type="button"
          onClick={onOpenQueue}
          aria-label={`Queue, ${queueCount} ${queueCount === 1 ? "track" : "tracks"}`}
        >
          Queue ({queueCount})
        </button>
        <Link to="/about" aria-current={pathname === "/about" ? "page" : undefined}>
          About
        </Link>
      </nav>
      <div className="topbar-actions">
        <ThemeToggle />
      </div>
    </header>
  );
}
