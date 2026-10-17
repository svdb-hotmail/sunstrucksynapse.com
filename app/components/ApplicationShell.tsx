import type { Ref } from "react";
import { Link } from "react-router";
import { Header } from "~/components/Header";
import { MobileNav } from "~/components/MobileNav";
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
  const openQueue = () => player.onViewChange?.("queue");
  return (
    <div className="app-shell listener-shell" data-has-player={Boolean(player.item)}>
      <a className="listener-skip" href="#listener-content">
        Skip to music
      </a>
      <Header navigation={navigation} queueCount={player.queue.length} onOpenQueue={openQueue} />
      <main id="listener-content" className="content-panel">
        {children}
      </main>
      <footer className="listener-footer">
        <p>Human-curated. AI-assisted. Music made with intent.</p>
        <Link to="/about">About SunSyn</Link>
        <Link to="/privacy">Privacy</Link>
      </footer>
      <PlayerPanel ref={playerPanelRef} {...player} />
      <MobileNav navigation={navigation} queueCount={player.queue.length} onOpenQueue={openQueue} />
    </div>
  );
}
