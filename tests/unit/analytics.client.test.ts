import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("analytics client", () => {
  it("falls back to memory when sessionStorage is unavailable and stays non-throwing", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(undefined));
    vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => false) });
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn().mockReturnValue("00000000-0000-0000-0000-000000000001"),
    });
    // Simulate blocked storage by removing sessionStorage entirely
    vi.stubGlobal("sessionStorage", undefined);

    const { recordPlaybackEvent } = await import("../../app/services/analytics.client");

    expect(() => recordPlaybackEvent("play_requested", { trackId: "track-1" })).not.toThrow();
    expect(() => recordPlaybackEvent("playback_started", { trackId: "track-1" })).not.toThrow();

    // Both calls should still have fired analytics via fetch
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Session IDs should be consistent across calls (memory fallback)
    const firstBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit)?.body as string);
    const secondBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit)?.body as string);
    expect(firstBody.anonymousSessionId).toBe(secondBody.anonymousSessionId);
  });
});
