import { Link, useLocation } from "react-router";
import {
  defaultCatalogueNavigation,
  isCatalogueNavigationEntryActive,
  type CatalogueNavigationEntry,
} from "~/services/catalogue";

export function MobileNav({
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
    <nav className="mobile-tabs" aria-label="Mobile navigation">
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
        Queue{" "}
        <span className="listener-count" aria-hidden="true">
          {queueCount}
        </span>
      </button>
    </nav>
  );
}
