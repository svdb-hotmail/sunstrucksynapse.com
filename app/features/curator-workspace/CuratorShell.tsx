import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router";

import type { CuratorIdentityView, CuratorNavigationItem, CuratorSection } from "./types";

export interface CuratorShellProps {
  activeSection: CuratorSection;
  children: ReactNode;
  identity: CuratorIdentityView;
  navigation: readonly CuratorNavigationItem[];
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

export function CuratorShell({
  activeSection,
  children,
  identity,
  navigation,
  onSearch,
  searchPlaceholder = "Search submissions, artists, or references",
}: CuratorShellProps) {
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSearch?.(String(data.get("query") ?? "").trim());
  };

  return (
    <div className="curator-app">
      <aside className="curator-sidebar" aria-label="Curator workspace">
        <Link
          className="curator-brand"
          to="/curator/submissions"
          aria-label="SunSyn curator workspace"
        >
          <span className="curator-brand__mark" aria-hidden="true">
            ☼
          </span>
          <span>
            <strong>sunsyn.art</strong>
            <small>Curator workspace</small>
          </span>
        </Link>
        <nav className="curator-navigation" aria-label="Curator">
          {navigation.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              aria-current={item.id === activeSection ? "page" : undefined}
              className={item.separatorBefore ? "curator-navigation__separated" : undefined}
            >
              <span>{item.label}</span>
              {item.count === undefined ? null : (
                <span className="curator-navigation__count">{item.count}</span>
              )}
            </Link>
          ))}
        </nav>
        <p className="curator-sidebar__principle">Focus on the music. Keep the decision human.</p>
      </aside>
      <div className="curator-stage">
        <header className="curator-topbar">
          <form className="curator-search" role="search" onSubmit={submitSearch}>
            <span aria-hidden="true">⌕</span>
            <label className="sr-only" htmlFor="curator-search-query">
              Search curator workspace
            </label>
            <input
              id="curator-search-query"
              name="query"
              type="search"
              placeholder={searchPlaceholder}
            />
            <kbd>Ctrl K</kbd>
          </form>
          <button
            type="button"
            className="curator-identity"
            aria-label={`Curator account: ${identity.name}`}
          >
            <span aria-hidden="true">{identity.initials}</span>
            <span>
              <strong>{identity.name}</strong>
              <small>Curator</small>
            </span>
            <span aria-hidden="true">⌄</span>
          </button>
        </header>
        <main className="curator-main">{children}</main>
      </div>
    </div>
  );
}
