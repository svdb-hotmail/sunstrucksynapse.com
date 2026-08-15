export function Header() {
  return (
    <header className="topbar">
      <a className="site-logo" href="#top" aria-label="Sunstruck Synapse Radio home">
        <span className="mini-orb">SS</span>
        <span>Sunstruck Synapse Radio</span>
      </a>

      <nav className="desktop-nav" aria-label="Primary">
        <a href="#latest">Latest</a>
        <a href="#audio">Listen</a>
        <a href="#video">Watch</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </nav>

      <a className="subscribe" href="#about">
        About the radio
      </a>
    </header>
  );
}
