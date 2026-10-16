import {
  catalogueViews,
  type CatalogueQuery,
  type CuratorCatalogueTrack,
} from "~/types/curator-catalogue";
import { validateUuid } from "./curator-validation";

export function parseCatalogueQuery(params: URLSearchParams): CatalogueQuery {
  const query = (params.get("q") ?? "").trim();
  const view = params.get("view");
  const trackId = params.get("track");
  if (
    query.length > 200 ||
    (view !== null && !catalogueViews.some((candidate) => candidate === view)) ||
    (trackId !== null && !validateUuid(trackId).ok)
  )
    throw new Error("Invalid catalogue filter.");
  let after: CatalogueQuery["after"] = null;
  const cursor = params.get("after");
  if (cursor !== null) {
    if (cursor.length > 1000) throw new Error("Invalid catalogue page.");
    const value: unknown = JSON.parse(cursor);
    if (
      !value ||
      typeof value !== "object" ||
      !("title" in value) ||
      !("id" in value) ||
      typeof value.title !== "string" ||
      value.title.length > 200 ||
      !validateUuid(value.id).ok
    )
      throw new Error("Invalid catalogue page.");
    after = { title: value.title, id: value.id as string };
  }
  return { query, view: view as CatalogueQuery["view"], trackId, after };
}

export function catalogueActionLabel(track: CuratorCatalogueTrack) {
  if (track.state === "live") return "View details";
  if (track.state === "ready") return "Review publication";
  if (track.state === "preparing") return "View progress";
  if (track.state === "scheduled") return "View schedule";
  if (track.state === "archived") return "View history";
  return "Resolve";
}

export function catalogueVisibility(track: CuratorCatalogueTrack) {
  if (track.publiclyListed) return track.publicMediaReady ? "Live" : "Listed · media unavailable";
  return "Not live";
}

export function catalogueExplanation(track: CuratorCatalogueTrack) {
  if (track.publiclyListed && !track.publicMediaReady)
    return "The public page is listed, but no ready listening file is available.";
  if (track.state === "live")
    return "The public track, release and artist are visible with a ready listening file.";
  if (track.lifecycleStatus === "published")
    return "The track is marked published, but a required public parent is unavailable. Review the release and artist states.";
  if (track.releaseStatus === "published" && track.state === "attention")
    return "The release is marked published, but this track is not live. Review the complete release before confirming publication.";
  if (track.state === "scheduled")
    return "This track is waiting for its scheduled publication time.";
  if (track.lifecycleStatus === "scheduled")
    return "Publication is overdue or the schedule is missing. Check its blockers and audit history.";
  if (track.preparationStatus === "failed")
    return "Streaming preparation failed. Open release preparation to review the failure and retry.";
  if (track.state === "preparing")
    return "Streaming preparation is in progress. This stage does not need a human decision.";
  if (track.state === "ready")
    return "The publication checks pass. Review the complete release and confirm when it should go live.";
  if (track.state === "archived")
    return "This track is archived and is not in the public catalogue.";
  return "Resolve the listed readiness checks before publishing the complete release.";
}
