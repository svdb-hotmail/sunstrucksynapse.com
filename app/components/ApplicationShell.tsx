import type { Ref } from "react";

import { Header } from "~/components/Header";
import { MobileNav } from "~/components/MobileNav";
import { PlayerPanel } from "~/components/PlayerPanel";
import type { CatalogueItem, MediaKind, QueueEntry } from "~/types/catalogue";

interface ApplicationShellProps {
  children: React.ReactNode;
  item: CatalogueItem;
  mode: MediaKind;
  queue: QueueEntry[];
  playerPanelRef: Ref<HTMLElement>;
  onModeChange: (mode: MediaKind) => void;
  onClearQueue: () => void;
}

export function ApplicationShell({
  children,
  item,
  mode,
  queue,
  playerPanelRef,
  onModeChange,
  onClearQueue,
}: ApplicationShellProps) {
  return (
    <>
      <div className="app-shell">
        <PlayerPanel
          ref={playerPanelRef}
          item={item}
          mode={mode}
          queue={queue}
          onModeChange={onModeChange}
          onClearQueue={onClearQueue}
        />
        <main className="content-panel">
          <Header />
          {children}
        </main>
      </div>
      <MobileNav />
    </>
  );
}
