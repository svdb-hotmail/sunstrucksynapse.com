import { describe, expect, it, vi } from "vitest";

import {
  createMediaDeliveryUrl,
  isR2MediaUrl,
  verifyMediaSignature,
} from "../../app/services/media-signing";
import {
  PlaybackCoordinator,
  type PlaybackMediaElement,
} from "../../app/services/playback-coordinator";
import type { CatalogueItem } from "../../app/types/catalogue";
import { makeCatalogueItem } from "../fixtures/catalogue";

function createMockMediaElement(): PlaybackMediaElement & {
  loadCalls: number;
  playCalls: number;
  pauseCalls: number;
} {
  return {
    src: "",
    currentTime: 0,
    paused: true,
    loadCalls: 0,
    playCalls: 0,
    pauseCalls: 0,
    load() {
      this.loadCalls += 1;
    },
    async play() {
      this.playCalls += 1;
      this.paused = false;
    },
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("player playback behavior and coordinator lifecycle", () => {
  const secret = "test-signing-secret";

  function createR2Track(
    id: string,
    assetId: string,
  ): Extract<CatalogueItem, { mediaKind: "audio" }> {
    const base = makeCatalogueItem(id);
    return {
      ...base,
      mediaKind: "audio",
      media: {
        src: `/media/audio/${assetId}`,
        mimeType: "audio/mpeg",
      },
    };
  }

  function createStaticTrack(id: string): Extract<CatalogueItem, { mediaKind: "audio" }> {
    return makeCatalogueItem(id, {
      mediaKind: "audio",
    }) as Extract<CatalogueItem, { mediaKind: "audio" }>;
  }

  it("proves selection performs no mint and initializes canonical source for native controls", () => {
    const r2Item = createR2Track("r2-item-1", "asset-1");
    const mockResolveUrl = vi.fn();
    const activeSrcChanges: (string | null)[] = [];
    const media = createMockMediaElement();

    const coordinator = new PlaybackCoordinator({
      resolveUrl: mockResolveUrl,
      onActiveSrcChange: (src) => activeSrcChanges.push(src),
    });
    coordinator.attachMedia(media);

    coordinator.selectItem(r2Item);

    // No signed URL was minted or fetched on selection
    expect(mockResolveUrl).not.toHaveBeenCalled();
    // Canonical src is populated so native browser controls are initialized and enabled, with no eager load
    expect(media.src).toBe("/media/audio/asset-1");
    expect(media.loadCalls).toBe(0);
    expect(activeSrcChanges).toEqual(["/media/audio/asset-1"]);
  });

  it("proves delayed play >5 minutes later refreshes URL immediately before playing", async () => {
    const t0 = new Date("2026-08-16T08:00:00Z");
    const tDelayedPlay = new Date("2026-08-16T08:06:30Z"); // 6.5 minutes later
    const assetId = "asset-delayed-playback-42";
    const r2Item = createR2Track("r2-delayed-item", assetId);

    // Expired URL from t0
    const oldUrlAtT0 = await createMediaDeliveryUrl("", "audio", assetId, secret, t0);
    await expect(
      verifyMediaSignature(new URL(oldUrlAtT0, "https://example.com"), secret, tDelayedPlay),
    ).resolves.toBe(false);

    // Fresh URL at tDelayedPlay
    const freshSignedUrl = await createMediaDeliveryUrl("", "audio", assetId, secret, tDelayedPlay);

    const mockResolveUrl = vi.fn().mockResolvedValue(freshSignedUrl);
    const media = createMockMediaElement();
    const coordinator = new PlaybackCoordinator({
      resolveUrl: mockResolveUrl,
    });
    coordinator.attachMedia(media);

    // Item selected at t0
    coordinator.selectItem(r2Item);
    expect(mockResolveUrl).not.toHaveBeenCalled();

    // User clicks native play >5 min later at tDelayedPlay
    await coordinator.handleNativePlay();

    expect(mockResolveUrl).toHaveBeenCalledTimes(1);
    expect(mockResolveUrl).toHaveBeenCalledWith("/media/audio/asset-delayed-playback-42");
    expect(media.src).toBe(freshSignedUrl);
    expect(media.playCalls).toBe(1);

    // Verified fresh URL is valid at tDelayedPlay
    await expect(
      verifyMediaSignature(new URL(media.src, "https://example.com"), secret, tDelayedPlay),
    ).resolves.toBe(true);
  });

  it("proves each subsequent play/resume attempt calls refresh again with no stale URL reuse", async () => {
    const assetId = "asset-subsequent-play-7";
    const r2Item = createR2Track("r2-track", assetId);
    const media = createMockMediaElement();

    const url1 = await createMediaDeliveryUrl(
      "",
      "audio",
      assetId,
      secret,
      new Date("2026-08-16T08:00:00Z"),
    );
    const url2 = await createMediaDeliveryUrl(
      "",
      "audio",
      assetId,
      secret,
      new Date("2026-08-16T08:02:00Z"),
    );

    const mockResolveUrl = vi.fn().mockResolvedValueOnce(url1).mockResolvedValueOnce(url2);

    const coordinator = new PlaybackCoordinator({
      resolveUrl: mockResolveUrl,
    });
    coordinator.attachMedia(media);
    coordinator.selectItem(r2Item);

    // First play attempt
    await coordinator.handleNativePlay();
    expect(mockResolveUrl).toHaveBeenCalledTimes(1);
    expect(media.src).toBe(url1);

    // User pauses
    media.pause();
    media.currentTime = 45;

    // Second play attempt (resume) must refresh again immediately before playing
    await coordinator.handleNativePlay();
    expect(mockResolveUrl).toHaveBeenCalledTimes(2);
    expect(media.src).toBe(url2);
    // Preserves playback position
    expect(media.currentTime).toBe(45);
    expect(media.playCalls).toBe(2);
  });

  it("proves retry after 403 or playback error calls refresh again and updates media source", async () => {
    const assetId = "asset-retry-test-88";
    const r2Item = createR2Track("r2-retry-item", assetId);
    const media = createMockMediaElement();

    const initialUrl = await createMediaDeliveryUrl(
      "",
      "audio",
      assetId,
      secret,
      new Date("2026-08-16T08:00:00Z"),
    );
    const retriedFreshUrl = await createMediaDeliveryUrl(
      "",
      "audio",
      assetId,
      secret,
      new Date("2026-08-16T08:08:00Z"),
    );

    const mockResolveUrl = vi
      .fn()
      .mockResolvedValueOnce(initialUrl)
      .mockResolvedValueOnce(retriedFreshUrl);

    const errors: (string | null)[] = [];
    const coordinator = new PlaybackCoordinator({
      resolveUrl: mockResolveUrl,
      onErrorChange: (err) => errors.push(err),
    });
    coordinator.attachMedia(media);
    coordinator.selectItem(r2Item);

    // Initial play
    await coordinator.playRequested(r2Item);
    expect(mockResolveUrl).toHaveBeenCalledTimes(1);
    expect(media.src).toBe(initialUrl);

    // Simulate error/failure
    media.pause();
    media.currentTime = 30;

    // Retry must fetch a fresh signed URL
    await coordinator.retry();
    expect(mockResolveUrl).toHaveBeenCalledTimes(2);
    expect(media.src).toBe(retriedFreshUrl);
    expect(media.currentTime).toBe(30);
    expect(media.playCalls).toBe(2);
  });

  it("ensures static Phase 1 assets make no refresh requests across selection, play, resume and retry", async () => {
    const staticItem = createStaticTrack("static-track-1");
    const media = createMockMediaElement();
    const mockResolveUrl = vi.fn();

    expect(isR2MediaUrl(staticItem.media!.src)).toBe(false);

    const coordinator = new PlaybackCoordinator({
      resolveUrl: mockResolveUrl,
    });
    coordinator.attachMedia(media);

    // 1. Selection
    coordinator.selectItem(staticItem);
    expect(media.src).toBe(staticItem.media!.src);
    expect(mockResolveUrl).not.toHaveBeenCalled();

    // 2. Play request
    await coordinator.playRequested(staticItem);
    expect(media.src).toBe(staticItem.media!.src);
    expect(media.playCalls).toBe(1);
    expect(mockResolveUrl).not.toHaveBeenCalled();

    // 3. Native play attempt
    await coordinator.handleNativePlay();
    expect(mockResolveUrl).not.toHaveBeenCalled();

    // 4. Retry
    await coordinator.retry();
    expect(media.src).toBe(staticItem.media!.src);
    expect(media.playCalls).toBe(2);
    expect(mockResolveUrl).not.toHaveBeenCalled();
  });

  it("keeps active playback intact when an equivalent item object is delivered", () => {
    const item = createR2Track("equivalent-item", "equivalent-asset");
    const media = createMockMediaElement();
    const activeSrcChanges: (string | null)[] = [];
    const coordinator = new PlaybackCoordinator({
      onActiveSrcChange: (src) => activeSrcChanges.push(src),
    });
    coordinator.attachMedia(media);
    coordinator.selectItem(item);

    media.src = "/media/audio/equivalent-asset?expires=next";
    media.currentTime = 37;
    media.paused = false;
    const counts = {
      load: media.loadCalls,
      play: media.playCalls,
      pause: media.pauseCalls,
      callbacks: activeSrcChanges.length,
    };

    coordinator.selectItem({
      ...item,
      description: { ...item.description, subtitle: "Updated metadata" },
      media: { ...item.media! },
    });

    expect(media.src).toBe("/media/audio/equivalent-asset?expires=next");
    expect(media.currentTime).toBe(37);
    expect(media.paused).toBe(false);
    expect(media.loadCalls).toBe(counts.load);
    expect(media.playCalls).toBe(counts.play);
    expect(media.pauseCalls).toBe(counts.pause);
    expect(activeSrcChanges).toHaveLength(counts.callbacks);
  });

  it("resets a same-ID replacement when its canonical asset or media kind changes", () => {
    const item = createR2Track("replacement-item", "asset-before");
    const media = createMockMediaElement();
    const coordinator = new PlaybackCoordinator();
    coordinator.attachMedia(media);
    coordinator.selectItem(item);
    media.src = "/media/audio/asset-before?expires=old";
    media.currentTime = 24;
    media.paused = false;

    coordinator.selectItem(createR2Track("replacement-item", "asset-after"));

    expect(media.src).toBe("/media/audio/asset-after");
    expect(media.currentTime).toBe(0);
    expect(media.paused).toBe(true);
    expect(media.loadCalls).toBe(0);
    expect(media.pauseCalls).toBe(2);

    const videoReplacement: CatalogueItem = {
      ...createR2Track("replacement-item", "asset-after"),
      mediaKind: "video",
      media: { src: "/media/audio/asset-after", mimeType: "video/mp4" },
    };
    coordinator.selectItem(videoReplacement);
    expect(media.src).toBe("/media/audio/asset-after");
    expect(media.currentTime).toBe(0);
    expect(media.pauseCalls).toBe(3);
  });

  it("ignores stale signed resolution and failure after a same-ID replacement", async () => {
    const first = createR2Track("racing-item", "asset-first");
    const second = createR2Track("racing-item", "asset-second");
    const firstResult = deferred<string>();
    const secondResult = deferred<string>();
    const resolveUrl = vi
      .fn()
      .mockImplementationOnce(() => firstResult.promise)
      .mockImplementationOnce(() => secondResult.promise);
    const media = createMockMediaElement();
    const errors: (string | null)[] = [];
    const loading: boolean[] = [];
    const coordinator = new PlaybackCoordinator({
      resolveUrl,
      onErrorChange: (error) => errors.push(error),
      onLoadingChange: (isLoading) => loading.push(isLoading),
    });
    coordinator.attachMedia(media);
    coordinator.selectItem(first);

    const firstRequest = coordinator.playRequested(first);
    const secondRequest = coordinator.playRequested(second);
    firstResult.reject(new Error("stale failure"));
    await firstRequest;
    expect(errors.at(-1)).toBe(null);
    expect(loading.at(-1)).toBe(true);
    secondResult.resolve("/media/audio/asset-second?signature=fresh");
    await secondRequest;

    expect(media.src).toBe("/media/audio/asset-second?signature=fresh");
    expect(errors).not.toContain(
      "Playback could not be loaded or started automatically. Use the player controls to begin.",
    );
    expect(loading.at(-1)).toBe(false);
  });

  it("keeps static playback intact when equivalent metadata is delivered", () => {
    const item = createStaticTrack("static-equivalent-item");
    const media = createMockMediaElement();
    const coordinator = new PlaybackCoordinator();
    coordinator.attachMedia(media);
    coordinator.selectItem(item);
    media.currentTime = 19;
    media.paused = false;
    const pauseCalls = media.pauseCalls;

    coordinator.selectItem({
      ...item,
      description: { ...item.description, title: "Updated static metadata" },
      media: { ...item.media! },
    });

    expect(media.src).toBe(item.media!.src);
    expect(media.currentTime).toBe(19);
    expect(media.paused).toBe(false);
    expect(media.pauseCalls).toBe(pauseCalls);
    expect(media.loadCalls).toBe(0);
    expect(media.playCalls).toBe(0);
  });

  it("lets a newer same-item retry win over an older pending retry", async () => {
    const item = createR2Track("retry-race-item", "retry-race-asset");
    const firstResult = deferred<string>();
    const secondResult = deferred<string>();
    const resolveUrl = vi
      .fn()
      .mockImplementationOnce(() => firstResult.promise)
      .mockImplementationOnce(() => secondResult.promise);
    const media = createMockMediaElement();
    const coordinator = new PlaybackCoordinator({ resolveUrl });
    coordinator.attachMedia(media);
    coordinator.selectItem(item);

    const firstRetry = coordinator.retry();
    const secondRetry = coordinator.retry();
    secondResult.resolve("/media/audio/retry-race-asset?signature=second");
    await secondRetry;
    firstResult.resolve("/media/audio/retry-race-asset?signature=first");
    await firstRetry;

    expect(media.src).toBe("/media/audio/retry-race-asset?signature=second");
  });

  it("keeps an equivalent metadata refresh from invalidating a pending request", async () => {
    const item = createR2Track("metadata-refresh-item", "metadata-refresh-asset");
    const result = deferred<string>();
    const media = createMockMediaElement();
    const coordinator = new PlaybackCoordinator({ resolveUrl: vi.fn(() => result.promise) });
    coordinator.attachMedia(media);
    coordinator.selectItem(item);

    const request = coordinator.playRequested(item);
    coordinator.selectItem({ ...item, description: { ...item.description, title: "Refreshed" } });
    result.resolve("/media/audio/metadata-refresh-asset?signature=fresh");
    await request;

    expect(media.src).toBe("/media/audio/metadata-refresh-asset?signature=fresh");
    expect(media.playCalls).toBe(1);
  });

  it("suppresses AbortError but reports genuine play failures and clears loading", async () => {
    const item = createR2Track("play-failure-item", "play-failure-asset");
    const abortMedia = createMockMediaElement();
    abortMedia.play = vi.fn().mockRejectedValue({ name: "AbortError" });
    const abortErrors: (string | null)[] = [];
    const abortLoading: boolean[] = [];
    const abortCoordinator = new PlaybackCoordinator({
      resolveUrl: vi.fn().mockResolvedValue("/media/audio/play-failure-asset?signature=abort"),
      onErrorChange: (error) => abortErrors.push(error),
      onLoadingChange: (isLoading) => abortLoading.push(isLoading),
    });
    abortCoordinator.attachMedia(abortMedia);
    await abortCoordinator.playRequested(item);
    expect(abortErrors).not.toContain(
      "Playback could not be loaded or started automatically. Use the player controls to begin.",
    );
    expect(abortLoading.at(-1)).toBe(false);

    const failedMedia = createMockMediaElement();
    failedMedia.play = vi.fn().mockRejectedValue(new Error("not allowed"));
    const failedErrors: (string | null)[] = [];
    const failedLoading: boolean[] = [];
    const failedCoordinator = new PlaybackCoordinator({
      resolveUrl: vi.fn().mockResolvedValue("/media/audio/play-failure-asset?signature=failed"),
      onErrorChange: (error) => failedErrors.push(error),
      onLoadingChange: (isLoading) => failedLoading.push(isLoading),
    });
    failedCoordinator.attachMedia(failedMedia);
    await failedCoordinator.playRequested(item);
    expect(failedErrors.at(-1)).toContain("Playback could not be loaded");
    expect(failedLoading.at(-1)).toBe(false);
  });
});
