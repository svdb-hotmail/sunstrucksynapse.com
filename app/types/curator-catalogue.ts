import type { Lifecycle } from "~/repositories/curator.server";

export const catalogueViews = [
  "all",
  "attention",
  "ready",
  "preparing",
  "scheduled",
  "live",
  "archived",
] as const;
export type CatalogueView = (typeof catalogueViews)[number];
export type CatalogueStatus = Exclude<CatalogueView, "all">;
export const catalogueLabels: Record<CatalogueView, string> = {
  all: "All tracks",
  attention: "Needs attention",
  ready: "Ready",
  preparing: "Preparing",
  scheduled: "Scheduled",
  live: "Live",
  archived: "Archived",
};
export interface CatalogueCursor {
  title: string;
  id: string;
}
export interface CatalogueQuery {
  query: string;
  view: CatalogueView | null;
  after: CatalogueCursor | null;
  trackId: string | null;
}
export interface CuratorCatalogueTrack {
  id: string;
  title: string;
  artistName: string;
  releaseId: string;
  releaseTitle: string;
  releaseSlug: string;
  slug: string;
  state: CatalogueStatus;
  lifecycleStatus: Lifecycle;
  releaseStatus: Lifecycle;
  artistStatuses: Lifecycle[];
  publiclyListed: boolean;
  publicMediaReady: boolean;
  coverReady: boolean;
  blockers: string[];
  submissionId: string | null;
  preparationStatus: string | null;
  failureCode: string | null;
  scheduledFor: string | null;
  previewUrl: string | null;
  releaseTrackCount: number;
  updatedAt: string;
}
export interface CatalogueAudit {
  id: string;
  entityType: string;
  fromLifecycle: Lifecycle;
  toLifecycle: Lifecycle;
  reason: string | null;
  occurredAt: string;
}
export interface CuratorCataloguePage {
  items: CuratorCatalogueTrack[];
  counts: Record<CatalogueView, number>;
  view: CatalogueView;
  next: CatalogueCursor | null;
  selected: CuratorCatalogueTrack | null;
  history: CatalogueAudit[];
  observedAt: string;
}
export interface CuratorCatalogueRepository {
  read(query: CatalogueQuery): Promise<CuratorCataloguePage>;
}
