import { Link } from "react-router";

export function Header() {
  return (
    <header className="topbar">
      <Link className="site-logo" to="/" aria-label="Sunstruck Synapse Radio home">
        <span className="mini-orb">SS</span>
        <span>Sunstruck Synapse Radio</span>
      </Link>

      <nav className="desktop-nav" aria-label="Primary">
        <Link to="/#latest">Latest</Link>
        <Link to="/#audio">Listen</Link>
        <Link to="/#video">Watch</Link>
        <Link to="/search">Search</Link>
        <Link to="/#about">About</Link>
        <Link to="/#contact">Contact</Link>
      </nav>

      <Link className="subscribe" to="/#about">
        About the radio
      </Link>
    </header>
  );
}
