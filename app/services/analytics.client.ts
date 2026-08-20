import type { PlaybackEventInput, PlaybackEventName } from "~/types/analytics";

const SESSION_KEY = "ssr-analytics-session";
let inMemorySessionId: string | null = null;

function sessionId(): string {
  if (inMemorySessionId) {
    return inMemorySessionId;
  }

  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      inMemorySessionId = stored;
      return stored;
    }

    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, generated);
    inMemorySessionId = generated;
    return generated;
  } catch {
    inMemorySessionId ??= crypto.randomUUID();
    return inMemorySessionId;
  }
}

export function recordPlaybackEvent(
  eventName: PlaybackEventName,
  details: Pick<PlaybackEventInput, "trackId" | "collectionId" | "progressSeconds"> = {},
): void {
  try {
    const body = JSON.stringify({
      eventId: crypto.randomUUID(),
      eventName,
      anonymousSessionId: sessionId(),
      occurredAt: new Date().toISOString(),
      ...details,
    } satisfies PlaybackEventInput);

    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) {
      return;
    }

    void fetch("/api/events", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics is deliberately best-effort and must never affect playback.
  }
}
