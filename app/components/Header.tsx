export function Header() {
  return (
    <header className="topbar">
      <a className="site-logo" href="#top" aria-label="Sunstruck Synapse home">
        <span className="mini-orb">SS</span>
        <span>Sunstruck Synapse</span>
      </a>

      <nav className="desktop-nav" aria-label="Primary">
        <a href="#latest">Latest</a>
        <a href="#audio">Audio</a>
        <a href="#video">Video</a>
        <a href="#offerings">Offerings</a>
        <a href="#contact">Contact</a>
      </nav>

      <a className="subscribe" href="#contact">
        Book / inquire
      </a>
    </header>
  );
}
