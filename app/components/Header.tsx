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
  queueCount = 0,
  onOpenQueue,
}: {
  navigation?: CatalogueNavigationEntry[];
  queueCount?: number;
  onOpenQueue?: () => void;
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
        <button
          type="button"
          onClick={onOpenQueue}
          aria-label={`Queue, ${queueCount} ${queueCount === 1 ? "track" : "tracks"}`}
        >
          Queue{queueCount > 0 ? <span className="nav-count">{queueCount}</span> : null}
        </button>
      </nav>
      <div className="topbar-actions preview-label">
        {import.meta.env.MODE === "site-preview" ? (
          <>
            Design preview <ThemeToggle badge="SDP–2" />
          </>
        ) : (
          <ThemeToggle />
        )}
      </div>
    </header>
  );
}
