import { Link, useLocation } from "react-router";

import {
  defaultCatalogueNavigation,
  isCatalogueNavigationEntryActive,
  type CatalogueNavigationEntry,
} from "~/services/catalogue";

export function MobileNav({
  navigation = defaultCatalogueNavigation,
}: {
  navigation?: CatalogueNavigationEntry[];
}) {
  const { pathname, hash } = useLocation();

  return (
    <nav
      className="mobile-tabs"
      aria-label="Mobile navigation"
      style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }}
    >
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
  );
}
