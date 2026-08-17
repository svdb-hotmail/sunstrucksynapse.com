import type { PlaybackEventInput, PlaybackEventName } from "~/types/analytics";

const SESSION_KEY = "ssr-analytics-session";

function sessionId(): string {
  let value = window.sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export function recordPlaybackEvent(
  eventName: PlaybackEventName,
  details: Pick<PlaybackEventInput, "trackId" | "collectionId" | "progressSeconds"> = {},
): void {
  const body = JSON.stringify({
    eventId: crypto.randomUUID(),
    eventName,
    anonymousSessionId: sessionId(),
    occurredAt: new Date().toISOString(),
    ...details,
  } satisfies PlaybackEventInput);
  try {
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
