import { Link } from "react-router";

import { SITE_NAME, SITE_URL } from "~/config/brand";
import { ThemeToggle } from "~/design-system/ThemeToggle";

const SITE_HOSTNAME = new URL(SITE_URL).hostname.replace(/^www\./, "");

export function Header() {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <Link className="site-logo" to="/" aria-label={`${SITE_NAME} home`}>
          <span className="mini-orb" aria-hidden="true">
            ☼
          </span>
          <span className="site-wordmark">{SITE_HOSTNAME}</span>
        </Link>
        <h2>A radio for music made with intent.</h2>
      </div>

      <nav className="desktop-nav" aria-label="Primary">
        <Link to="/#latest">Latest</Link>
        <Link to="/#audio">Listen</Link>
        <Link to="/#video">Watch</Link>
        <Link to="/search">Search</Link>
        <Link to="/#about">About</Link>
      </nav>

      <div className="topbar-actions">
        <ThemeToggle />
        <Link className="subscribe" to="/submission-terms">
          <span aria-hidden="true">◆</span> Reviewed disclosure <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
