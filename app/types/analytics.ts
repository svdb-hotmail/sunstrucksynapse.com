export const playbackEventNames = [
  "catalogue_impression",
  "collection_view",
  "play_requested",
  "playback_started",
  "listen_30_seconds",
  "completion",
  "skip",
  "replay",
  "playback_error",
  "share",
  "outbound_artist_click",
] as const;

export type PlaybackEventName = (typeof playbackEventNames)[number];

export interface PlaybackEventInput {
  eventId: string;
  eventName: PlaybackEventName;
  anonymousSessionId: string;
  trackId?: string;
  collectionId?: string;
  progressSeconds?: number;
  occurredAt: string;
}

export interface AnalyticsSummaryRow {
  id: string;
  name: string;
  starts: number;
  listens30: number;
  completions: number;
  skips: number;
  replays: number;
}
