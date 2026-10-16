import type { CuratorCatalogueTrack } from "../types/curator-catalogue";

export function hasActivePreparation(tracks: CuratorCatalogueTrack[]) {
  return tracks.some((track) => ["queued", "processing"].includes(track.preparationStatus ?? ""));
}

// Schedule from completion so a slow loader cannot overlap the next request.
// Visibility is checked at each tick; hidden tabs consume no request budget.
export function startCatalogueRefresh(refresh: () => Promise<void>, visible: () => boolean) {
  let stopped = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(
      async () => {
        if (visible()) {
          attempts++;
          try {
            await refresh();
          } catch {
            // The route owns its error UI. Keep retries bounded even on failure.
          }
        }
        if (!stopped && attempts < 8) schedule();
      },
      Math.min(5000 * 2 ** attempts, 60000),
    );
  };
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
