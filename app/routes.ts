import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("artists/:artistSlug", "routes/artist.tsx"),
  route("releases/:releaseSlug", "routes/release.tsx"),
  route("tracks/:releaseSlug/:trackSlug", "routes/track.tsx"),
  route("tracks/:releaseSlug/:trackSlug/disclosure", "routes/track-disclosure.tsx"),
  route("collections/:collectionSlug", "routes/collection.tsx"),
  route("search", "routes/search.tsx"),
  route("api/events", "routes/api-events.ts"),
  route("submit/:invitationToken", "routes/submission.tsx"),
  route("submission-evidence/:token", "routes/submission-evidence.ts"),
  route("curator", "routes/curator.tsx"),
  route("curator/submissions", "routes/curator-submissions.tsx"),
  route("curator/analytics", "routes/curator-analytics.tsx"),
  route("media/:kind/:assetId", "routes/media.ts"),
  route("curator/api/uploads/:sessionId?", "routes/curator-uploads.ts"),
  route("curator/api/entities/:entityType/:entityId?", "routes/curator-entities.ts"),
] satisfies RouteConfig;
