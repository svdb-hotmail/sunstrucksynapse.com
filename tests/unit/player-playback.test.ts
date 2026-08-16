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

describe("player playback behavior and coordinator lifecycle", () => {
  const secret = "test-signing-secret";

  function createR2Track(id: string, assetId: string): CatalogueItem {
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

  function createStaticTrack(id: string): CatalogueItem {
    return makeCatalogueItem(id, { mediaKind: "audio" });
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
    const freshSignedUrl = await createMediaDeliveryUrl(
      "",
      "audio",
      assetId,
      secret,
      tDelayedPlay,
    );

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
});

