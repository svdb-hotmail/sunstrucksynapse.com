import { Link, useLocation } from "react-router";

import { ProductBrand } from "~/components/ProductBrand";
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
        <ProductBrand destination="/" />
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
