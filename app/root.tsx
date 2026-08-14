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
import {
  getCatalogueItem,
  initialCatalogueItem,
  initialQueue,
} from "~/data/catalogue";
import type {
  CatalogueItem,
  MediaKind,
  PlayerOutletContext,
  PlayerState,
} from "~/types/catalogue";

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
  const [player, setPlayer] = useState<PlayerState>({
    selectedItemId: initialCatalogueItem.id,
    mode: initialCatalogueItem.mediaKind,
  });
  const [queue, setQueue] = useState(initialQueue);
  const selectedItem = getCatalogueItem(player.selectedItemId);

  const selectItem = useCallback((item: CatalogueItem) => {
    setPlayer({
      selectedItemId: item.id,
      mode: item.mediaKind,
    });

    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      playerPanelRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
      playerPanelRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const setMode = useCallback((mode: MediaKind) => {
    setPlayer((current) => ({ ...current, mode }));
  }, []);

  const outletContext: PlayerOutletContext = {
    selectedItemId: selectedItem.id,
    selectItem,
  };

  return (
    <ApplicationShell
      item={selectedItem}
      mode={player.mode}
      queue={queue}
      playerPanelRef={playerPanelRef}
      onModeChange={setMode}
      onClearQueue={() => setQueue([])}
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
