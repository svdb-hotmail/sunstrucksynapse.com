import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("artists/:artistSlug", "routes/artist.tsx"),
  route("releases/:releaseSlug", "routes/release.tsx"),
  route("tracks/:releaseSlug/:trackSlug", "routes/track.tsx"),
] satisfies RouteConfig;
