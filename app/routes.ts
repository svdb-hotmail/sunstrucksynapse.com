import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("artists/:artistSlug", "routes/artist.tsx"),
  route("releases/:releaseSlug", "routes/release.tsx"),
  route("tracks/:releaseSlug/:trackSlug", "routes/track.tsx"),
  route("collections/:collectionSlug", "routes/collection.tsx"),
  route("curator", "routes/curator.tsx"),
  route("media/:kind/:assetId", "routes/media.ts"),
  route("curator/api/uploads/:sessionId?", "routes/curator-uploads.ts"),
  route("curator/api/entities/:entityType/:entityId?", "routes/curator-entities.ts"),
] satisfies RouteConfig;
