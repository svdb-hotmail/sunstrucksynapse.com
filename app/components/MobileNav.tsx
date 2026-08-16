import { Link } from "react-router";

export function MobileNav() {
  return (
    <nav className="mobile-tabs" aria-label="Mobile navigation">
      <Link to="/#latest">Latest</Link>
      <Link to="/#audio">Listen</Link>
      <Link to="/#video">Watch</Link>
      <Link to="/#about">About</Link>
    </nav>
  );
}
