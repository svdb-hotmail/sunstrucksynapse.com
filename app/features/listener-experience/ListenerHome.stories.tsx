import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ApplicationShell } from "~/components/ApplicationShell";
import { CatalogueSection } from "~/components/CatalogueSection";
import { Intro } from "~/components/Intro";
import { buildCatalogueNavigation } from "~/services/catalogue";
import type { CatalogueItem, QueueEntry } from "~/types/catalogue";
import { addQueueItem, findAdjacentPlayableItem, removeQueueItem } from "~/utils/queue";

import { initialListenerQueue, listenerItems, listenerSections } from "./fixtures";
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

function ListenerHomePrototype() {
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
      navigation={buildCatalogueNavigation(listenerSections)}
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
      <Intro />
      <div id="catalogue" className="catalogue-anchor">
        {listenerSections.map((section) => (
          <CatalogueSection
            key={section.id}
            section={section}
            selectedItemId={selectedItemId}
            onSelect={selectItem}
            onQueue={(item) => setQueue((current) => addQueueItem(current, item, section.id))}
            onPlay={playItem}
          />
        ))}
      </div>
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

const meta = {
  title: "Listener Experience/Home/Interactive product preview",
  component: ListenerHomePrototype,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The complete listener-facing home experience, composed from the same production header, player, catalogue, navigation, theme control, and design tokens shipped by the application.",
      },
    },
  },
} satisfies Meta<typeof ListenerHomePrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = { globals: { theme: "dark" } };
export const LightTheme: Story = { globals: { theme: "light" } };
