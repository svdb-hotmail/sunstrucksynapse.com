import { Link } from "react-router";

import { SITE_MARK, SITE_NAME } from "~/config/brand";
import { ThemeToggle } from "~/design-system/ThemeToggle";

export function Header() {
  return (
    <header className="topbar">
      <Link className="site-logo" to="/" aria-label={`${SITE_NAME} home`}>
        <span className="mini-orb">{SITE_MARK}</span>
        <span>{SITE_NAME}</span>
      </Link>

      <nav className="desktop-nav" aria-label="Primary">
        <Link to="/#latest">Latest</Link>
        <Link to="/#audio">Listen</Link>
        <Link to="/#video">Watch</Link>
        <Link to="/search">Search</Link>
        <Link to="/#about">About</Link>
        <Link to="/#contact">Contact</Link>
      </nav>

      <div className="topbar-actions">
        <ThemeToggle />
        <Link className="subscribe" to="/#about">
          About the radio
        </Link>
      </div>
    </header>
  );
}
