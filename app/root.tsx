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
import { loadPublicCatalogue } from "~/repositories/catalogue.server";
import { catalogueLoadingMessage, findCatalogueItem } from "~/services/catalogue";
import type {
  CatalogueItem,
  PlayerOutletContext,
  PlayerState,
  QueueEntry,
} from "~/types/catalogue";
import { persistPlayerToStorage, restorePlayerFromStorage } from "~/utils/player-storage";
import {
  addQueueItem,
  findAdjacentPlayableItem,
  findNextPlayableQueueEntry,
  removeQueueItem,
} from "~/utils/queue";

import type { Route } from "./+types/root";
import "./styles/global.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/assets/favicon.svg", type: "image/svg+xml" },
];

export async function loader({ context }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  return loadPublicCatalogue(catalogueRepository);
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#11111a" />
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
  const catalogue = useLoaderData<typeof loader>();
  const catalogueItems = catalogue.items;
  const itemsById = useMemo(
    () => new Map(catalogueItems.map((item) => [item.id, item])),
    [catalogueItems],
  );
  const defaultItem = catalogueItems.find((item) => item.media) ?? catalogueItems[0] ?? null;
  const playerPanelRef = useRef<HTMLElement>(null);
  const playbackSequence = useRef(0);
  const persistenceEnabled = useRef(true);
  const userInteractedBeforeRestore = useRef(false);
  const [hasRestoredPlayer, setHasRestoredPlayer] = useState(false);
  const [player, setPlayer] = useState<PlayerState>({
    selectedItemId: defaultItem?.id ?? null,
  });
  const [playbackRequest, setPlaybackRequest] = useState<{
    itemId: string;
    sequence: number;
    collectionId?: string;
  } | null>(null);
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
    const restored = restorePlayerFromStorage(storage, catalogueItems, defaultItem?.id ?? null);
    persistenceEnabled.current = restored.persistenceAvailable;
    if (!userInteractedBeforeRestore.current) {
      setPlayer({ selectedItemId: restored.player.selectedItemId });
      setQueue(restored.player.queue);
    }
    setHasRestoredPlayer(true);
  }, [catalogueItems, defaultItem?.id]);

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
    persistenceEnabled.current = persistPlayerToStorage(storage, player.selectedItemId, queue);
  }, [hasRestoredPlayer, player.selectedItemId, queue]);

  const selectItem = useCallback((item: CatalogueItem) => {
    userInteractedBeforeRestore.current = true;
    setPlayer({ selectedItemId: item.id });
    setPlaybackRequest(null);
  }, []);

  const requestPlayback = useCallback(
    (item: CatalogueItem, moveFocus = true, collectionId?: string) => {
      userInteractedBeforeRestore.current = true;
      setPlayer({ selectedItemId: item.id });
      if (!item.media) {
        setPlaybackRequest(null);
        return;
      }
      playbackSequence.current += 1;
      setPlaybackRequest({
        itemId: item.id,
        sequence: playbackSequence.current,
        ...(collectionId !== undefined ? { collectionId } : {}),
      });

      if (!moveFocus) {
        return;
      }

      window.requestAnimationFrame(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        playerPanelRef.current?.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        });
        playerPanelRef.current?.focus({ preventScroll: true });
      });
    },
    [],
  );

  const selectQueueEntry = useCallback(
    (entry: QueueEntry) => {
      const item = itemsById.get(entry.itemId);
      setQueue((current) => removeQueueItem(current, entry.itemId));
      if (item?.media) {
        requestPlayback(item, true, entry.collectionId);
      } else if (item) {
        selectItem(item);
      }
    },
    [itemsById, requestPlayback, selectItem],
  );

  const advancePlayback = useCallback(
    (moveFocus = false) => {
      const nextQueued = findNextPlayableQueueEntry(queue, (itemId) => itemsById.get(itemId));
      if (nextQueued) {
        const queuedItem = itemsById.get(nextQueued.itemId);
        setQueue((current) => removeQueueItem(current, nextQueued.itemId));
        if (queuedItem) {
          requestPlayback(queuedItem, moveFocus, nextQueued.collectionId);
        }
        return;
      }

      if (!selectedItem) {
        return;
      }
      const nextItem = findAdjacentPlayableItem(catalogueItems, selectedItem.id, 1);
      if (nextItem) {
        requestPlayback(nextItem, moveFocus);
      }
    },
    [catalogueItems, itemsById, queue, requestPlayback, selectedItem],
  );

  const playPrevious = useCallback(() => {
    if (!selectedItem) {
      return;
    }
    const previousItem = findAdjacentPlayableItem(catalogueItems, selectedItem.id, -1);
    if (previousItem) {
      requestPlayback(previousItem, false);
    }
  }, [catalogueItems, requestPlayback, selectedItem]);

  const queueItem = useCallback((item: CatalogueItem, collectionId?: string) => {
    userInteractedBeforeRestore.current = true;
    setQueue((current) => addQueueItem(current, item, collectionId));
  }, []);

  const hasPrevious = selectedItem
    ? Boolean(findAdjacentPlayableItem(catalogueItems, selectedItem.id, -1))
    : false;
  const hasNext =
    queue.length > 0 ||
    (selectedItem ? Boolean(findAdjacentPlayableItem(catalogueItems, selectedItem.id, 1)) : false);

  const outletContext: PlayerOutletContext = {
    selectedItemId: selectedItem?.id ?? null,
    catalogue,
    selectItem,
    queueItem,
    playItem: (item, collectionId) => requestPlayback(item, true, collectionId),
  };

  return (
    <>
      <HashNavigation />
      <ApplicationShell
        item={selectedItem ?? null}
        queue={queue}
        playerPanelRef={playerPanelRef}
        playbackRequest={playbackRequest}
        onClearQueue={() => {
          userInteractedBeforeRestore.current = true;
          setQueue([]);
        }}
        onSelectQueueEntry={selectQueueEntry}
        onRemoveQueueEntry={(itemId) => {
          userInteractedBeforeRestore.current = true;
          setQueue((current) => removeQueueItem(current, itemId));
        }}
        onPrevious={playPrevious}
        onNext={() => advancePlayback(false)}
        canPrevious={hasPrevious}
        canNext={hasNext}
        onMediaEnded={() => advancePlayback(false)}
      >
        <Outlet context={outletContext} />
      </ApplicationShell>
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
      <p className="eyebrow">Sunstruck Synapse</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <a href="/">Return home</a>
    </main>
  );
}
