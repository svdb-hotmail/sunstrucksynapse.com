import { Link } from "react-router";

import { defaultCatalogueNavigation, type CatalogueNavigationEntry } from "~/services/catalogue";

export function MobileNav({
  navigation = defaultCatalogueNavigation,
}: {
  navigation?: CatalogueNavigationEntry[];
}) {
  return (
    <nav
      className="mobile-tabs"
      aria-label="Mobile navigation"
      style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }}
    >
      {navigation.map((entry) => (
        <Link key={entry.to} to={entry.to}>
          {entry.label}
        </Link>
      ))}
    </nav>
  );
}
