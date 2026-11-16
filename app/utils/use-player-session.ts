import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { CatalogueItem, PlayerState, QueueEntry } from "~/types/catalogue";
import {
  persistPlayerToStorage,
  restorePlayerFromStorage,
  type RestoredPlayer,
} from "./player-storage";
import { useHydrated } from "./use-hydrated";

export function usePlayerSession(items: CatalogueItem[]) {
  const hydrated = useHydrated();
  const persistenceEnabled = useRef(true);
  const restored = useMemo(() => {
    let storage: Storage | null = null;
    if (hydrated) {
      try {
        storage = window.localStorage;
      } catch {
        // A blocked storage API still leaves the in-memory player usable.
      }
    }
    return restorePlayerFromStorage(storage, items, null);
  }, [hydrated, items]);
  // User input takes ownership of the whole session, including input before hydration completes.
  const [session, setSession] = useState<RestoredPlayer | null>(null);
  const current = session ?? restored.player;
  const player = useMemo(
    () => ({ selectedItemId: current.selectedItemId, origin: current.origin }),
    [current.selectedItemId, current.origin],
  );
  const setPlayer = useCallback(
    (next: PlayerState) => {
      setSession((previous) => ({
        ...(previous ?? restored.player),
        ...next,
        origin: next.origin,
      }));
    },
    [restored.player],
  );
  const setQueue = useCallback(
    (next: SetStateAction<QueueEntry[]>) => {
      setSession((previous) => {
        const value = previous ?? restored.player;
        return { ...value, queue: typeof next === "function" ? next(value.queue) : next };
      });
    },
    [restored.player],
  );
  const setPlaybackScope = useCallback(
    (scope: string[] | null) => {
      setSession((previous) => ({
        ...(previous ?? restored.player),
        playbackScope: scope ?? undefined,
      }));
    },
    [restored.player],
  );
  useEffect(() => {
    if (!hydrated || !restored.persistenceAvailable || !persistenceEnabled.current) return;
    try {
      persistenceEnabled.current = persistPlayerToStorage(
        window.localStorage,
        current.selectedItemId,
        current.queue,
        current.playbackScope,
        current.origin,
      );
    } catch {
      persistenceEnabled.current = false;
    }
  }, [hydrated, restored.persistenceAvailable, current]);
  return {
    player,
    setPlayer,
    queue: current.queue,
    setQueue,
    playbackScope: current.playbackScope ?? null,
    setPlaybackScope,
  };
}
