import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from "react-router";

import { ApplicationShell } from "~/components/ApplicationShell";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { SITE_NAME } from "~/config/brand";
import {
  DEFAULT_THEME,
  getDocumentTheme,
  THEME_COLORS,
  THEME_INIT_SCRIPT,
} from "~/design-system/theme";
import { loadPublicCatalogue } from "~/repositories/catalogue.server";
import {
  defaultCatalogueNavigation,
  catalogueLoadingMessage,
  findCatalogueItem,
} from "~/services/catalogue";
import type {
  CatalogueItem,
  PlaybackOrigin,
  PlayerOutletContext,
  PlayerState,
  QueueEntry,
} from "~/types/catalogue";
import { persistPlayerToStorage, restorePlayerFromStorage } from "~/utils/player-storage";
import {
  appendAlbumQueue,
  findAdjacentPlayableItem,
  findNextPlayableQueueEntry,
  queuedPlaybackScope,
  reconcilePlaybackScope,
  removeQueueItem,
  scopedQueue,
} from "~/utils/queue";

import type { Route } from "./+types/root";
import "./styles/global.css";
import "./styles/curator-catalogue.css";
import "./styles/listener.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/assets/favicon.svg", type: "image/svg+xml" },
];

export async function loader({ context }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  return loadPublicCatalogue(catalogueRepository);
}

function getThemeColorForDocument(): string {
  if (typeof document === "undefined") {
    return THEME_COLORS[DEFAULT_THEME];
  }

  return THEME_COLORS[getDocumentTheme(document)];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const themeColor = getThemeColorForDocument();

  return (
    <html lang="en" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content={themeColor} suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function HashNavigation() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!target) {
        return;
      }
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.key, location.pathname]);

  return null;
}

export default function App() {
  const location = useLocation();
  const privateWorkspace = /^\/(curator|submit)(\/|$)/.test(location.pathname);
  const catalogue = useLoaderData<typeof loader>();
  const catalogueItems = catalogue.items;
  const navigation = defaultCatalogueNavigation;
  const itemsById = useMemo(
    () => new Map(catalogueItems.map((item) => [item.id, item])),
    [catalogueItems],
  );
  const playerPanelRef = useRef<HTMLElement>(null);
  const playbackSequence = useRef(0);
  const persistenceEnabled = useRef(true);
  const userInteractedBeforeRestore = useRef(false);
  const [hasRestoredPlayer, setHasRestoredPlayer] = useState(false);
  const [player, setPlayer] = useState<PlayerState>({
    selectedItemId: null,
  });
  const [playbackRequest, setPlaybackRequest] = useState<{
    itemId: string;
    sequence: number;
    collectionId?: string;
    intent?: "resume";
  } | null>(null);
  const [playbackScope, setPlaybackScope] = useState<string[] | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const selectedItem = player.selectedItemId
    ? findCatalogueItem(catalogueItems, player.selectedItemId)
    : undefined;

  useEffect(() => {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      persistenceEnabled.current = false;
    }
    const restored = restorePlayerFromStorage(storage, catalogueItems, null);
    persistenceEnabled.current = restored.persistenceAvailable;
    if (!userInteractedBeforeRestore.current) {
      setPlayer({ selectedItemId: restored.player.selectedItemId, origin: restored.player.origin });
      setPlaybackScope(restored.player.playbackScope ?? null);
      setQueue(restored.player.queue);
    }
    setHasRestoredPlayer(true);
  }, [catalogueItems]);

  useEffect(() => {
    if (!hasRestoredPlayer || !persistenceEnabled.current) {
      return;
    }
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      persistenceEnabled.current = false;
      return;
    }
    persistenceEnabled.current = persistPlayerToStorage(
      storage,
      player.selectedItemId,
      queue,
      playbackScope,
      player.origin,
    );
  }, [hasRestoredPlayer, player.selectedItemId, player.origin, queue, playbackScope]);

  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const [view, setView] = useState<"player" | "queue" | null>(null);
  const [queueNotice, setQueueNotice] = useState<string | null>(null);
  const [undoQueue, setUndoQueue] = useState<{
    queue: QueueEntry[];
    scope: string[] | null;
  } | null>(null);

  const selectItem = useCallback((item: CatalogueItem) => {
    userInteractedBeforeRestore.current = true;
    setPlayer({ selectedItemId: item.id });
    setPlaybackRequest(null);
    setPlaybackScope(null);
  }, []);

  const requestPlayback = useCallback(
    (item: CatalogueItem, collectionId?: string, intent?: "resume", origin?: PlaybackOrigin) => {
      if (!item.media) return;
      userInteractedBeforeRestore.current = true;
      setPlayer({
        selectedItemId: item.id,
        origin: origin
          ? {
              albumId: origin.albumId,
              selectionId: origin.selectionId ?? (origin.albumId ? crypto.randomUUID() : undefined),
              collectionId: origin.collectionId,
            }
          : undefined,
      });
      setPlayingItemId(null);
      playbackSequence.current += 1;
      setPlaybackRequest({
        itemId: item.id,
        sequence: playbackSequence.current,
        collectionId,
        intent,
      });
      // A queue undo belongs to the current track, never to an already consumed queue.
      setUndoQueue(null);
      setQueueNotice(null);
    },
    [],
  );

  const changeQueue = (next: QueueEntry[], message: string) => {
    userInteractedBeforeRestore.current = true;
    setUndoQueue({ queue, scope: playbackScope });
    setQueue(next);
    setPlaybackScope(reconcilePlaybackScope(playbackScope, player.selectedItemId, next));
    setQueueNotice(message);
  };

  const selectQueueEntry = useCallback(
    (entry: QueueEntry) => {
      const item = itemsById.get(entry.itemId);
      if (!item?.media) return;
      setPlaybackScope(queuedPlaybackScope(queue, entry, playbackScope, player.selectedItemId));
      setQueue((current) => removeQueueItem(current, entry.itemId));
      requestPlayback(item, entry.collectionId, undefined, playbackScope ? player.origin : entry);
      setView(null);
    },
    [itemsById, playbackScope, player.origin, player.selectedItemId, queue, requestPlayback],
  );

  const advancePlayback = useCallback(() => {
    const nextQueued = findNextPlayableQueueEntry(queue, (itemId) => itemsById.get(itemId));
    if (nextQueued) {
      const queuedItem = itemsById.get(nextQueued.itemId);
      if (queuedItem) {
        setPlaybackScope(
          queuedPlaybackScope(queue, nextQueued, playbackScope, player.selectedItemId),
        );
        setQueue((current) => removeQueueItem(current, nextQueued.itemId));
        requestPlayback(
          queuedItem,
          nextQueued.collectionId,
          undefined,
          playbackScope ? player.origin : nextQueued,
        );
      }
      return;
    }
    // The queue is authoritative for a finite selection, including edits and repeats.
    if (!selectedItem || playbackScope) return;
    const nextItem = findAdjacentPlayableItem(catalogueItems, selectedItem.id, 1);
    if (nextItem) requestPlayback(nextItem, playbackRequest?.collectionId);
  }, [
    catalogueItems,
    itemsById,
    playbackScope,
    player.origin,
    player.selectedItemId,
    playbackRequest?.collectionId,
    queue,
    requestPlayback,
    selectedItem,
  ]);

  const playPrevious = useCallback(() => {
    if (!selectedItem) return;
    const tracks = playbackScope
      ? playbackScope
          .map((id) => itemsById.get(id))
          .filter((item): item is CatalogueItem => Boolean(item))
      : catalogueItems;
    const previous = findAdjacentPlayableItem(tracks, selectedItem.id, -1);
    if (!previous) return;
    if (playbackScope) {
      const remaining = tracks.slice(tracks.findIndex((track) => track.id === previous.id) + 1);
      const ordered = scopedQueue(remaining, player.origin).map(
        (entry) => queue.find((queued) => queued.itemId === entry.itemId) ?? entry,
      );
      setQueue((current) => [
        ...ordered,
        ...current.filter((entry) => !playbackScope.includes(entry.itemId)),
      ]);
    }
    requestPlayback(previous, playbackRequest?.collectionId, undefined, player.origin);
  }, [
    catalogueItems,
    itemsById,
    playbackScope,
    player.origin,
    queue,
    playbackRequest?.collectionId,
    requestPlayback,
    selectedItem,
  ]);

  const queueItem = (item: CatalogueItem, collectionId?: string) => {
    if (!item.media) return;
    if (queue.some((entry) => entry.itemId === item.id)) {
      setUndoQueue(null);
      setQueueNotice("Already in your queue.");
      return;
    }
    const next = [...queue, ...scopedQueue([item], { ...player.origin, collectionId })];
    changeQueue(next, `Added to queue · position ${next.length}.`);
  };
  const scopedItems = playbackScope
    ? playbackScope
        .map((id) => itemsById.get(id))
        .filter((item): item is CatalogueItem => Boolean(item))
    : catalogueItems;
  const hasPrevious = Boolean(
    selectedItem && findAdjacentPlayableItem(scopedItems, selectedItem.id, -1),
  );
  const hasNext = Boolean(
    findNextPlayableQueueEntry(queue, (id) => itemsById.get(id)) ||
      (!playbackScope && selectedItem && findAdjacentPlayableItem(scopedItems, selectedItem.id, 1)),
  );

  const outletContext: PlayerOutletContext = {
    selectedItemId: selectedItem?.id ?? null,
    playingItemId,
    catalogue,
    selectItem,
    queueItem,
    playItem: (item, collectionId) => {
      if (!item.media) return;
      if (item.id === selectedItem?.id) {
        if (playingItemId === item.id)
          playerPanelRef.current?.querySelector<HTMLMediaElement>("audio, video")?.pause();
        else requestPlayback(item, collectionId, "resume", player.origin);
        return;
      }
      setPlaybackScope(null);
      setQueue((current) => removeQueueItem(current, item.id));
      requestPlayback(item, collectionId);
    },
    playNext: (item, collectionId) => {
      if (!item.media) return;
      changeQueue(
        [
          queue.find((entry) => entry.itemId === item.id) ??
            scopedQueue([item], { ...player.origin, collectionId })[0],
          ...removeQueueItem(queue, item.id),
        ],
        "Added to play next.",
      );
    },
    playSelection: (tracks, collectionId) => {
      const playable = [
        ...new Map(
          tracks.filter((track) => track.media).map((track) => [track.id, track]),
        ).values(),
      ];
      if (!playable.length) return;
      const origin = { selectionId: crypto.randomUUID(), collectionId };
      requestPlayback(playable[0], collectionId, undefined, origin);
      setPlaybackScope(playable.map((track) => track.id));
      setQueue(scopedQueue(playable.slice(1), origin));
    },
    playAlbum: (tracks) => {
      const playable = tracks.filter((track) => track.media);
      if (!playable.length) return;
      const origin = { albumId: playable[0].release.id, selectionId: crypto.randomUUID() };
      requestPlayback(playable[0], undefined, undefined, origin);
      setPlaybackScope(playable.map((track) => track.id));
      setQueue(scopedQueue(playable.slice(1), origin));
    },
    queueAlbum: (tracks) =>
      changeQueue(appendAlbumQueue(queue, tracks), "Album added in track order."),
  };

  return (
    <>
      <HashNavigation />
      {privateWorkspace ? (
        <Outlet />
      ) : (
        <ApplicationShell
          navigation={navigation}
          item={selectedItem ?? null}
          queue={queue}
          playerPanelRef={playerPanelRef}
          playbackRequest={playbackRequest}
          view={view}
          onViewChange={setView}
          onPlaybackStateChange={setPlayingItemId}
          queueNotice={queueNotice}
          onDismissNotice={() => {
            setQueueNotice(null);
            setUndoQueue(null);
          }}
          onUndoQueue={
            undoQueue
              ? () => {
                  userInteractedBeforeRestore.current = true;
                  setQueue(undoQueue.queue);
                  setPlaybackScope(undoQueue.scope);
                  setUndoQueue(null);
                  setQueueNotice("Queue change undone.");
                }
              : undefined
          }
          onClearQueue={() => changeQueue([], "Queue cleared.")}
          onSelectQueueEntry={selectQueueEntry}
          onRemoveQueueEntry={(itemId) =>
            changeQueue(removeQueueItem(queue, itemId), "Removed from queue.")
          }
          onMoveQueueEntry={(itemId, direction) => {
            const index = queue.findIndex((entry) => entry.itemId === itemId);
            const nextIndex = index + direction;
            if (index < 0 || nextIndex < 0 || nextIndex >= queue.length) return;
            const next = [...queue];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            changeQueue(next, direction === -1 ? "Moved up in queue." : "Moved down in queue.");
          }}
          onPrevious={playPrevious}
          onNext={advancePlayback}
          canPrevious={hasPrevious}
          canNext={hasNext}
          onMediaEnded={advancePlayback}
        >
          <Outlet context={outletContext} />
        </ApplicationShell>
      )}
    </>
  );
}

export function HydrateFallback() {
  return (
    <main className="catalogue-state" aria-live="polite">
      <p>{catalogueLoadingMessage}</p>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Unexpected error";
  let message = "The requested page could not be displayed.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Page not found" : "Request error";
    message = error.statusText || message;
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
  }

  return (
    <main className="error-page">
      <p className="eyebrow">{SITE_NAME}</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <a href="/">Return home</a>
    </main>
  );
}
