import { useRef, useState, type ReactNode } from "react";

import { ApplicationShell } from "~/components/ApplicationShell";
import type { CatalogueNavigationEntry } from "~/services/catalogue";
import type { CatalogueItem, QueueEntry } from "~/types/catalogue";
import { addQueueItem, findAdjacentPlayableItem, removeQueueItem } from "~/utils/queue";

import { initialListenerQueue, listenerItems } from "./fixtures";
import {
  ListenerAccountControl,
  ListenerFeedbackControl,
  ListenerSignInDialog,
  type ListenerAccountView,
} from "./ListenerIdentity";

const listenerItemsById = new Map(listenerItems.map((item) => [item.id, item]));
const listenerAccount: ListenerAccountView = {
  displayName: "Samuel",
  email: "listener@sunsyn.art",
  initials: "SV",
};

export interface ListenerPrototypeContext {
  selectedItemId: string;
  onPlay: (item: CatalogueItem) => void;
  onQueue: (item: CatalogueItem, collectionId?: string) => void;
  onSelect: (item: CatalogueItem) => void;
}

interface ListenerProductPrototypeProps {
  children: (context: ListenerPrototypeContext) => ReactNode;
  navigation: CatalogueNavigationEntry[];
}

export function ListenerProductPrototype({ children, navigation }: ListenerProductPrototypeProps) {
  const playerPanelRef = useRef<HTMLElement>(null);
  const playbackSequence = useRef(0);
  const [selectedItemId, setSelectedItemId] = useState(listenerItems[0]!.id);
  const [queue, setQueue] = useState<QueueEntry[]>(() => initialListenerQueue);
  const [account, setAccount] = useState<ListenerAccountView | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [votedItemIds, setVotedItemIds] = useState<Set<string>>(() => new Set());
  const [playbackRequest, setPlaybackRequest] = useState<{
    itemId: string;
    sequence: number;
  } | null>(null);
  const selectedItem = listenerItemsById.get(selectedItemId) ?? listenerItems[0]!;
  const previousItem = findAdjacentPlayableItem(listenerItems, selectedItem.id, -1);
  const nextItem = findAdjacentPlayableItem(listenerItems, selectedItem.id, 1);
  const remainingVotes = 5 - votedItemIds.size;
  const hasVoted = votedItemIds.has(selectedItem.id);

  const selectItem = (item: CatalogueItem) => {
    setSelectedItemId(item.id);
    setPlaybackRequest(null);
  };

  const playItem = (item: CatalogueItem) => {
    setSelectedItemId(item.id);
    if (!item.media) return;
    playbackSequence.current += 1;
    setPlaybackRequest({ itemId: item.id, sequence: playbackSequence.current });
  };

  const queueItem = (item: CatalogueItem, collectionId?: string) => {
    setQueue((current) => addQueueItem(current, item, collectionId));
  };

  const selectQueueEntry = (entry: QueueEntry) => {
    const item = listenerItemsById.get(entry.itemId);
    setQueue((current) => removeQueueItem(current, entry.itemId));
    if (item) playItem(item);
  };

  const toggleVote = () => {
    setVotedItemIds((current) => {
      const next = new Set(current);
      if (next.has(selectedItem.id)) {
        next.delete(selectedItem.id);
      } else if (next.size < 5) {
        next.add(selectedItem.id);
      }
      return next;
    });
  };

  return (
    <ApplicationShell
      navigation={navigation}
      accountControl={
        <ListenerAccountControl
          account={account}
          remainingVotes={remainingVotes}
          onOpenSignIn={() => setSignInOpen(true)}
          onSignOut={() => {
            setAccount(null);
            setVotedItemIds(new Set());
          }}
        />
      }
      playerSupplement={
        <ListenerFeedbackControl
          account={account}
          hasVoted={hasVoted}
          remainingVotes={remainingVotes}
          trackTitle={selectedItem.description.title}
          onOpenSignIn={() => setSignInOpen(true)}
          onToggleVote={toggleVote}
        />
      }
      item={selectedItem}
      queue={queue}
      playerPanelRef={playerPanelRef}
      playbackRequest={playbackRequest}
      onClearQueue={() => setQueue([])}
      onSelectQueueEntry={selectQueueEntry}
      onRemoveQueueEntry={(itemId) => setQueue((current) => removeQueueItem(current, itemId))}
      onPrevious={() => previousItem && playItem(previousItem)}
      onNext={() => nextItem && playItem(nextItem)}
      canPrevious={Boolean(previousItem)}
      canNext={Boolean(nextItem)}
      onMediaEnded={() => nextItem && playItem(nextItem)}
    >
      {children({
        selectedItemId,
        onPlay: playItem,
        onQueue: queueItem,
        onSelect: selectItem,
      })}
      {signInOpen ? (
        <ListenerSignInDialog
          onClose={() => setSignInOpen(false)}
          onComplete={() => {
            setAccount(listenerAccount);
            setSignInOpen(false);
          }}
        />
      ) : null}
    </ApplicationShell>
  );
}
