import type { Ref } from "react";

import { Header } from "~/components/Header";
import { MobileNav } from "~/components/MobileNav";
import { PlayerPanel } from "~/components/PlayerPanel";
import { defaultCatalogueNavigation, type CatalogueNavigationEntry } from "~/services/catalogue";
import type { CatalogueItem, QueueEntry } from "~/types/catalogue";

interface ApplicationShellProps {
  children: React.ReactNode;
  navigation?: CatalogueNavigationEntry[];
  item: CatalogueItem | null;
  queue: QueueEntry[];
  playerPanelRef: Ref<HTMLElement>;
  playbackRequest: { itemId: string; sequence: number } | null;
  onClearQueue: () => void;
  onSelectQueueEntry: (entry: QueueEntry) => void;
  onRemoveQueueEntry: (itemId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  onMediaEnded: () => void;
}

export function ApplicationShell({
  children,
  navigation = defaultCatalogueNavigation,
  item,
  queue,
  playerPanelRef,
  playbackRequest,
  onClearQueue,
  onSelectQueueEntry,
  onRemoveQueueEntry,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  onMediaEnded,
}: ApplicationShellProps) {
  return (
    <>
      <div className="app-shell">
        <Header navigation={navigation} />
        <PlayerPanel
          ref={playerPanelRef}
          item={item}
          queue={queue}
          playbackRequest={playbackRequest}
          onClearQueue={onClearQueue}
          onSelectQueueEntry={onSelectQueueEntry}
          onRemoveQueueEntry={onRemoveQueueEntry}
          onPrevious={onPrevious}
          onNext={onNext}
          canPrevious={canPrevious}
          canNext={canNext}
          onMediaEnded={onMediaEnded}
        />
        <main className="content-panel">{children}</main>
      </div>
      <MobileNav navigation={navigation} />
    </>
  );
}
