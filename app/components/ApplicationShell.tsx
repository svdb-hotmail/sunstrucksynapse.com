import type { Ref } from "react";

import { Header } from "~/components/Header";
import { MobileNav } from "~/components/MobileNav";
import { PlayerPanel } from "~/components/PlayerPanel";
import type { CatalogueItem, QueueEntry } from "~/types/catalogue";

interface ApplicationShellProps {
  children: React.ReactNode;
  item: CatalogueItem;
  queue: QueueEntry[];
  playerPanelRef: Ref<HTMLElement>;
  playbackRequest: { itemId: string; sequence: number } | null;
  onClearQueue: () => void;
  onSelectQueueEntry: (entry: QueueEntry) => void;
  onMediaEnded: () => void;
}

export function ApplicationShell({
  children,
  item,
  queue,
  playerPanelRef,
  playbackRequest,
  onClearQueue,
  onSelectQueueEntry,
  onMediaEnded,
}: ApplicationShellProps) {
  return (
    <>
      <div className="app-shell">
        <PlayerPanel
          ref={playerPanelRef}
          item={item}
          queue={queue}
          playbackRequest={playbackRequest}
          onClearQueue={onClearQueue}
          onSelectQueueEntry={onSelectQueueEntry}
          onMediaEnded={onMediaEnded}
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
