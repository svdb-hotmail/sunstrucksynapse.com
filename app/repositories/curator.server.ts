import { and, asc, eq, inArray, lte, ne, sql } from "drizzle-orm";

import type { Database } from "~/db/client.server";
import type { CuratorIdentity } from "~/types/curator";
import {
  artists,
  audioAssets,
  collectionItems,
  editorialCollections,
  publicationAudit,
  releaseArtistCredits,
  releases,
  trackArtistCredits,
  tracks,
  videoAssets,
} from "~/db/schema";

export type CuratorEntityType = "artist" | "release" | "track" | "collection";
export type Lifecycle = "draft" | "in_review" | "scheduled" | "published" | "archived";

export interface CuratorEntity {
  id: string;
  slug: string;
  title: string;
  lifecycleStatus: Lifecycle;
  scheduledFor: Date | null;
  showOnHomepage?: boolean;
  homepagePosition?: number | null;
  releaseId?: string;
  artistId?: string;
}

export interface CreateEntityInput {
  slug: string;
  title: string;
  artistId?: string;
  releaseId?: string;
  position?: number;
}

export interface UpdateEntityInput {
  slug?: string;
  title?: string;
}

export interface CollectionTarget {
  trackId?: string;
  releaseId?: string;
  annotation?: string | null;
}

export interface CuratorAuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  fromLifecycle: Lifecycle;
  toLifecycle: Lifecycle;
  actorEmail: string;
  reason: string | null;
  occurredAt: Date;
}

export interface CuratorCollectionItem {
  id: string;
  collectionId: string;
  trackId: string | null;
  releaseId: string | null;
  position: number;
  annotation: string | null;
}

export interface CuratorRepository {
  list(type: CuratorEntityType): Promise<CuratorEntity[]>;
  find(type: CuratorEntityType, id: string): Promise<CuratorEntity | null>;
  findBySlug(
    type: CuratorEntityType,
    slug: string,
    releaseId?: string,
  ): Promise<CuratorEntity | null>;
  create(type: CuratorEntityType, input: CreateEntityInput): Promise<CuratorEntity>;
  update(
    type: CuratorEntityType,
    id: string,
    input: UpdateEntityInput,
  ): Promise<CuratorEntity | null>;
  delete(type: CuratorEntityType, id: string): Promise<boolean>;
  hasReferences(type: CuratorEntityType, id: string): Promise<boolean>;
  setLifecycle(
    type: CuratorEntityType,
    id: string,
    from: Lifecycle,
    to: Lifecycle,
    now: Date,
    scheduledFor: Date | null,
    actor: CuratorIdentity,
    reason: string | null,
  ): Promise<boolean>;
  addCollectionItem(collectionId: string, target: CollectionTarget): Promise<void>;
  hasCollectionTarget(collectionId: string, target: CollectionTarget): Promise<boolean>;
  removeCollectionItem(collectionId: string, itemId: string): Promise<boolean>;
  reorderCollectionItems(collectionId: string, itemIds: string[]): Promise<boolean>;
  listCollectionItems(collectionId: string): Promise<CuratorCollectionItem[]>;
  configureCollectionHomepage(
    collectionId: string,
    showOnHomepage: boolean,
    homepagePosition: number | null,
  ): Promise<boolean>;
  homepagePositionInUse(collectionId: string, homepagePosition: number): Promise<boolean>;
  listAudit(): Promise<CuratorAuditEntry[]>;
  publishScheduled(now: Date): Promise<number>;
}

const artistSelection = {
  id: artists.id,
  slug: artists.slug,
  title: artists.displayName,
  lifecycleStatus: artists.lifecycleStatus,
  scheduledFor: artists.scheduledFor,
};
const releaseSelection = {
  id: releases.id,
  slug: releases.slug,
  title: releases.title,
  lifecycleStatus: releases.lifecycleStatus,
  scheduledFor: releases.scheduledFor,
};
const trackSelection = {
  id: tracks.id,
  slug: tracks.slug,
  title: tracks.title,
  lifecycleStatus: tracks.lifecycleStatus,
  scheduledFor: tracks.scheduledFor,
  releaseId: tracks.releaseId,
};
const collectionSelection = {
  id: editorialCollections.id,
  slug: editorialCollections.slug,
  title: editorialCollections.name,
  lifecycleStatus: editorialCollections.lifecycleStatus,
  scheduledFor: editorialCollections.scheduledFor,
  showOnHomepage: editorialCollections.showOnHomepage,
  homepagePosition: editorialCollections.homepagePosition,
};

export function createCuratorRepository(db: Database): CuratorRepository {
  async function list(type: CuratorEntityType): Promise<CuratorEntity[]> {
    if (type === "artist")
      return db.select(artistSelection).from(artists).orderBy(asc(artists.slug));
    if (type === "release")
      return db.select(releaseSelection).from(releases).orderBy(asc(releases.slug));
    if (type === "track")
      return db
        .select(trackSelection)
        .from(tracks)
        .orderBy(asc(tracks.releaseId), asc(tracks.position));
    return db
      .select(collectionSelection)
      .from(editorialCollections)
      .orderBy(asc(editorialCollections.slug));
  }

  async function find(type: CuratorEntityType, id: string): Promise<CuratorEntity | null> {
    const rows =
      type === "artist"
        ? await db.select(artistSelection).from(artists).where(eq(artists.id, id)).limit(1)
        : type === "release"
          ? await db.select(releaseSelection).from(releases).where(eq(releases.id, id)).limit(1)
          : type === "track"
            ? await db.select(trackSelection).from(tracks).where(eq(tracks.id, id)).limit(1)
            : await db
                .select(collectionSelection)
                .from(editorialCollections)
                .where(eq(editorialCollections.id, id))
                .limit(1);
    return rows[0] ?? null;
  }

  async function findBySlug(
    type: CuratorEntityType,
    slug: string,
    releaseId?: string,
  ): Promise<CuratorEntity | null> {
    if (type === "track" && releaseId) {
      const rows = await db
        .select(trackSelection)
        .from(tracks)
        .where(and(eq(tracks.slug, slug), eq(tracks.releaseId, releaseId)))
        .limit(1);
      return rows[0] ?? null;
    }
    const rows =
      type === "artist"
        ? await db.select(artistSelection).from(artists).where(eq(artists.slug, slug)).limit(1)
        : type === "release"
          ? await db.select(releaseSelection).from(releases).where(eq(releases.slug, slug)).limit(1)
          : type === "track"
            ? await db.select(trackSelection).from(tracks).where(eq(tracks.slug, slug)).limit(1)
            : await db
                .select(collectionSelection)
                .from(editorialCollections)
                .where(eq(editorialCollections.slug, slug))
                .limit(1);
    return rows[0] ?? null;
  }

  async function create(type: CuratorEntityType, input: CreateEntityInput): Promise<CuratorEntity> {
    if (type === "artist") {
      const [row] = await db
        .insert(artists)
        .values({ slug: input.slug, displayName: input.title })
        .returning(artistSelection);
      return row;
    }
    if (type === "release") {
      if (!input.artistId) throw new Error("Validated release artist missing.");
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(releases).values({ id, slug: input.slug, title: input.title }),
        db
          .insert(releaseArtistCredits)
          .values({ releaseId: id, artistId: input.artistId, position: 1 }),
      ]);
      return (await find("release", id))!;
    }
    if (type === "track") {
      if (!input.releaseId || !input.artistId || !input.position) {
        throw new Error("Validated track fields missing.");
      }
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(tracks).values({
          id,
          releaseId: input.releaseId,
          slug: input.slug,
          title: input.title,
          position: input.position,
        }),
        db
          .insert(trackArtistCredits)
          .values({ trackId: id, artistId: input.artistId, position: 1 }),
      ]);
      return (await find("track", id))!;
    }
    const [row] = await db
      .insert(editorialCollections)
      .values({ slug: input.slug, name: input.title })
      .returning(collectionSelection);
    return row;
  }

  async function update(
    type: CuratorEntityType,
    id: string,
    input: UpdateEntityInput,
  ): Promise<CuratorEntity | null> {
    const values = { ...(input.slug ? { slug: input.slug } : {}), updatedAt: new Date() };
    const rows =
      type === "artist"
        ? await db
            .update(artists)
            .set({ ...values, ...(input.title ? { displayName: input.title } : {}) })
            .where(eq(artists.id, id))
            .returning(artistSelection)
        : type === "release"
          ? await db
              .update(releases)
              .set({ ...values, ...(input.title ? { title: input.title } : {}) })
              .where(eq(releases.id, id))
              .returning(releaseSelection)
          : type === "track"
            ? await db
                .update(tracks)
                .set({ ...values, ...(input.title ? { title: input.title } : {}) })
                .where(eq(tracks.id, id))
                .returning(trackSelection)
            : await db
                .update(editorialCollections)
                .set({ ...values, ...(input.title ? { name: input.title } : {}) })
                .where(eq(editorialCollections.id, id))
                .returning(collectionSelection);
    return rows[0] ?? null;
  }

  async function remove(type: CuratorEntityType, id: string): Promise<boolean> {
    const rows =
      type === "artist"
        ? await db.delete(artists).where(eq(artists.id, id)).returning({ id: artists.id })
        : type === "release"
          ? await db.delete(releases).where(eq(releases.id, id)).returning({ id: releases.id })
          : type === "track"
            ? await db.delete(tracks).where(eq(tracks.id, id)).returning({ id: tracks.id })
            : await db
                .delete(editorialCollections)
                .where(eq(editorialCollections.id, id))
                .returning({ id: editorialCollections.id });
    return rows.length > 0;
  }

  async function hasReferences(type: CuratorEntityType, id: string): Promise<boolean> {
    if (type === "artist") {
      const [releaseCredit, trackCredit] = await Promise.all([
        db
          .select({ id: releaseArtistCredits.id })
          .from(releaseArtistCredits)
          .where(eq(releaseArtistCredits.artistId, id))
          .limit(1),
        db
          .select({ id: trackArtistCredits.id })
          .from(trackArtistCredits)
          .where(eq(trackArtistCredits.artistId, id))
          .limit(1),
      ]);
      return Boolean(releaseCredit[0] || trackCredit[0]);
    }
    if (type === "release") {
      const [track, collection] = await Promise.all([
        db.select({ id: tracks.id }).from(tracks).where(eq(tracks.releaseId, id)).limit(1),
        db
          .select({ id: collectionItems.id })
          .from(collectionItems)
          .where(eq(collectionItems.releaseId, id))
          .limit(1),
      ]);
      return Boolean(track[0] || collection[0]);
    }
    if (type === "track") {
      const [collection, audio, video] = await Promise.all([
        db
          .select({ id: collectionItems.id })
          .from(collectionItems)
          .where(eq(collectionItems.trackId, id))
          .limit(1),
        db
          .select({ id: audioAssets.id })
          .from(audioAssets)
          .where(eq(audioAssets.trackId, id))
          .limit(1),
        db
          .select({ id: videoAssets.id })
          .from(videoAssets)
          .where(eq(videoAssets.trackId, id))
          .limit(1),
      ]);
      return Boolean(collection[0] || audio[0] || video[0]);
    }
    return false;
  }

  async function setLifecycle(
    type: CuratorEntityType,
    id: string,
    from: Lifecycle,
    to: Lifecycle,
    now: Date,
    scheduledFor: Date | null,
    actor: CuratorIdentity,
    reason: string | null,
  ): Promise<boolean> {
    const table =
      type === "artist"
        ? artists
        : type === "release"
          ? releases
          : type === "track"
            ? tracks
            : editorialCollections;

    const scheduledForValue = to === "scheduled" ? scheduledFor : null;
    const publishedAtValue = to === "published" ? now : null;
    const archivedAtValue = to === "archived" ? now : null;

    const result = await db.execute<{ id: string }>(sql`
      with updated as (
        update ${table}
        set
          lifecycle_status = ${to},
          scheduled_for = ${scheduledForValue},
          published_at = ${publishedAtValue},
          archived_at = ${archivedAtValue},
          updated_at = ${now}
        where ${table.id} = ${id} and ${table.lifecycleStatus} = ${from}
        returning ${table.id} as id
      )
      insert into ${publicationAudit} (
        entity_type,
        entity_id,
        from_lifecycle,
        to_lifecycle,
        actor_email,
        actor_id,
        reason,
        occurred_at
      )
      select
        ${type},
        updated.id,
        ${from},
        ${to},
        ${actor.email},
        ${actor.id},
        ${reason},
        ${now}
      from updated
      returning ${publicationAudit.id} as id
    `);

    const rows = (result as { rows?: unknown[] }).rows ?? (Array.isArray(result) ? result : []);
    return rows.length > 0;
  }

  async function addCollectionItem(collectionId: string, target: CollectionTarget): Promise<void> {
    const [last] = await db
      .select({ position: collectionItems.position })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(sql`${collectionItems.position} desc`)
      .limit(1);
    await db.insert(collectionItems).values({
      collectionId,
      trackId: target.trackId,
      releaseId: target.releaseId,
      annotation: target.annotation,
      position: (last?.position ?? 0) + 1,
    });
  }

  async function hasCollectionTarget(
    collectionId: string,
    target: CollectionTarget,
  ): Promise<boolean> {
    const targetCondition = target.trackId
      ? eq(collectionItems.trackId, target.trackId)
      : eq(collectionItems.releaseId, target.releaseId!);
    const rows = await db
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .where(and(eq(collectionItems.collectionId, collectionId), targetCondition))
      .limit(1);
    return rows.length > 0;
  }

  async function removeCollectionItem(collectionId: string, itemId: string): Promise<boolean> {
    const removed = await db
      .delete(collectionItems)
      .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.id, itemId)))
      .returning({ id: collectionItems.id });
    if (!removed[0]) return false;
    const remaining = await db
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(asc(collectionItems.position), asc(collectionItems.id));
    if (remaining.length > 0)
      await reorderCollectionItems(
        collectionId,
        remaining.map(({ id }) => id),
      );
    return true;
  }

  async function reorderCollectionItems(collectionId: string, itemIds: string[]): Promise<boolean> {
    const existing = await db
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(asc(collectionItems.position), asc(collectionItems.id));
    if (
      existing.length !== itemIds.length ||
      new Set(itemIds).size !== itemIds.length ||
      existing.some(({ id }) => !itemIds.includes(id))
    )
      return false;
    const cases = itemIds.map((id, index) => sql`when ${id} then ${index + 1}`);
    const moveOutOfRange = db
      .update(collectionItems)
      .set({ position: sql`${collectionItems.position} + 1000000` })
      .where(
        and(eq(collectionItems.collectionId, collectionId), inArray(collectionItems.id, itemIds)),
      );
    const applyOrder = db
      .update(collectionItems)
      .set({ position: sql`case ${collectionItems.id} ${sql.join(cases, sql.raw(" "))} end` })
      .where(
        and(eq(collectionItems.collectionId, collectionId), inArray(collectionItems.id, itemIds)),
      );
    await db.batch([moveOutOfRange, applyOrder]);
    return true;
  }

  async function listCollectionItems(collectionId: string): Promise<CuratorCollectionItem[]> {
    return db
      .select({
        id: collectionItems.id,
        collectionId: collectionItems.collectionId,
        trackId: collectionItems.trackId,
        releaseId: collectionItems.releaseId,
        position: collectionItems.position,
        annotation: collectionItems.annotation,
      })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(asc(collectionItems.position), asc(collectionItems.id));
  }

  async function listAudit(): Promise<CuratorAuditEntry[]> {
    return db
      .select({
        id: publicationAudit.id,
        entityType: publicationAudit.entityType,
        entityId: publicationAudit.entityId,
        fromLifecycle: publicationAudit.fromLifecycle,
        toLifecycle: publicationAudit.toLifecycle,
        actorEmail: publicationAudit.actorEmail,
        reason: publicationAudit.reason,
        occurredAt: publicationAudit.occurredAt,
      })
      .from(publicationAudit)
      .orderBy(sql`${publicationAudit.occurredAt} desc`, sql`${publicationAudit.id} desc`);
  }

  async function configureCollectionHomepage(
    collectionId: string,
    showOnHomepage: boolean,
    homepagePosition: number | null,
  ): Promise<boolean> {
    const rows = await db
      .update(editorialCollections)
      .set({
        showOnHomepage,
        homepagePosition: showOnHomepage ? homepagePosition : null,
        updatedAt: new Date(),
      })
      .where(eq(editorialCollections.id, collectionId))
      .returning({ id: editorialCollections.id });
    return rows.length > 0;
  }

  async function homepagePositionInUse(
    collectionId: string,
    homepagePosition: number,
  ): Promise<boolean> {
    const rows = await db
      .select({ id: editorialCollections.id })
      .from(editorialCollections)
      .where(
        and(
          eq(editorialCollections.showOnHomepage, true),
          eq(editorialCollections.homepagePosition, homepagePosition),
          ne(editorialCollections.id, collectionId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async function publishScheduled(now: Date): Promise<number> {
    let count = 0;
    const system = { id: "scheduled-publication", email: "system@sunstrucksynapse.com" };
    for (const type of ["artist", "release", "track", "collection"] as const) {
      const table =
        type === "artist"
          ? artists
          : type === "release"
            ? releases
            : type === "track"
              ? tracks
              : editorialCollections;
      const due = await db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.lifecycleStatus, "scheduled"), lte(table.scheduledFor, now)))
        .orderBy(asc(table.scheduledFor), asc(table.id));
      for (const { id } of due) {
        if (
          await setLifecycle(
            type,
            id,
            "scheduled",
            "published",
            now,
            null,
            system,
            "Scheduled publication",
          )
        )
          count += 1;
      }
    }
    return count;
  }

  return {
    list,
    find,
    findBySlug,
    create,
    update,
    delete: remove,
    hasReferences,
    setLifecycle,
    addCollectionItem,
    hasCollectionTarget,
    removeCollectionItem,
    reorderCollectionItems,
    listCollectionItems,
    configureCollectionHomepage,
    homepagePositionInUse,
    listAudit,
    publishScheduled,
  };
}
