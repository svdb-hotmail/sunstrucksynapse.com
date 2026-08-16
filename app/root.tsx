import { useCallback, useRef, useState } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { ApplicationShell } from "~/components/ApplicationShell";
import { getCatalogueItem, initialCatalogueItem } from "~/data/catalogue";
import type {
  CatalogueItem,
  PlayerOutletContext,
  PlayerState,
  QueueEntry,
} from "~/types/catalogue";
import { addQueueItem, findNextPlayableQueueEntry, removeQueueItem } from "~/utils/queue";

import type { Route } from "./+types/root";
import "./styles/global.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/assets/favicon.svg", type: "image/svg+xml" },
];

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

export default function App() {
  const playerPanelRef = useRef<HTMLElement>(null);
  const playbackSequence = useRef(0);
  const [player, setPlayer] = useState<PlayerState>({
    selectedItemId: initialCatalogueItem.id,
  });
  const [playbackRequest, setPlaybackRequest] = useState<{
    itemId: string;
    sequence: number;
  } | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const selectedItem = getCatalogueItem(player.selectedItemId);

  const selectItem = useCallback((item: CatalogueItem) => {
    setPlayer({ selectedItemId: item.id });
    setPlaybackRequest(null);
  }, []);

  const requestPlayback = useCallback((item: CatalogueItem, moveFocus = true) => {
    setPlayer({ selectedItemId: item.id });
    playbackSequence.current += 1;
    setPlaybackRequest({ itemId: item.id, sequence: playbackSequence.current });

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
  }, []);

  const selectQueueEntry = useCallback(
    (entry: QueueEntry) => {
      const item = getCatalogueItem(entry.itemId);
      setQueue((current) => removeQueueItem(current, entry.itemId));
      if (item.media) {
        requestPlayback(item);
      } else {
        selectItem(item);
      }
    },
    [requestPlayback, selectItem],
  );

  const advanceQueue = useCallback(() => {
    const nextPlayable = findNextPlayableQueueEntry(queue, getCatalogueItem);
    if (!nextPlayable) {
      return;
    }

    setQueue((current) => removeQueueItem(current, nextPlayable.itemId));
    requestPlayback(getCatalogueItem(nextPlayable.itemId), false);
  }, [queue, requestPlayback]);

  const outletContext: PlayerOutletContext = {
    selectedItemId: selectedItem.id,
    selectItem,
    queueItem: (item) => setQueue((current) => addQueueItem(current, item)),
    playItem: requestPlayback,
  };

  return (
    <ApplicationShell
      item={selectedItem}
      queue={queue}
      playerPanelRef={playerPanelRef}
      playbackRequest={playbackRequest}
      onClearQueue={() => setQueue([])}
      onSelectQueueEntry={selectQueueEntry}
      onMediaEnded={advanceQueue}
    >
      <Outlet context={outletContext} />
    </ApplicationShell>
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
