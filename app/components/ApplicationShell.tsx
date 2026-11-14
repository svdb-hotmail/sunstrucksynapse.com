import type { Ref } from "react";
import { Link, useLocation } from "react-router";
import { Header } from "~/components/Header";
import { MobileNav } from "~/components/MobileNav";
import { ThemeToggle } from "~/design-system/ThemeToggle";
import { PlayerPanel, type PlayerPanelProps } from "~/components/PlayerPanel";
import { defaultCatalogueNavigation, type CatalogueNavigationEntry } from "~/services/catalogue";
interface ApplicationShellProps extends PlayerPanelProps {
  children: React.ReactNode;
  navigation?: CatalogueNavigationEntry[];
  playerPanelRef: Ref<HTMLElement>;
}
export function ApplicationShell({
  children,
  navigation = defaultCatalogueNavigation,
  playerPanelRef,
  ...player
}: ApplicationShellProps) {
  const openQueue = () => player.onViewChange?.(player.view === "queue" ? null : "queue");
  const { pathname } = useLocation();
  return (
    <div
      className="app-shell listener-shell"
      data-has-player={Boolean(player.item || player.queue.length)}
    >
      <a className="listener-skip" href="#listener-content">
        Skip to music
      </a>
      <Header navigation={navigation} />
      <main id="listener-content" className="content-panel main-content">
        {children}
      </main>
      <footer className="listener-footer site-footer">
        <span className="brand-display">SUNSYN RADIO</span>
        <span>Independent sound. Human selection.</span>
        <Link to="/about" aria-current={pathname === "/about" ? "page" : undefined}>
          About SunSyn
        </Link>
        <Link to="/privacy">Privacy</Link>
        <span className="mobile-theme">
          <ThemeToggle />
        </span>
        <small>
          {import.meta.env.MODE === "site-preview"
            ? "Design preview · sample catalogue · production unchanged"
            : "Music made with intent."}
        </small>
      </footer>
      <PlayerPanel ref={playerPanelRef} {...player} />
      <MobileNav navigation={navigation} queueCount={player.queue.length} onOpenQueue={openQueue} />
    </div>
  );
}
