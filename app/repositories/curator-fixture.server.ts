import type {
  CollectionTarget,
  CreateEntityInput,
  CuratorAuditEntry,
  CuratorCollectionItem,
  CuratorEntity,
  CuratorEntityType,
  CuratorRepository,
  Lifecycle,
  UpdateEntityInput,
} from "./curator.server";

interface StoredEntity extends CuratorEntity {
  artistId?: string;
  releaseId?: string;
}

export function createE2eCuratorRepository(): CuratorRepository {
  const entities = new Map<CuratorEntityType, StoredEntity[]>(
    (["artist", "release", "track", "collection"] as const).map((type) => [type, []]),
  );
  const collectionItems: CuratorCollectionItem[] = [];
  const audit: CuratorAuditEntry[] = [];

  const find = async (type: CuratorEntityType, id: string) =>
    entities.get(type)!.find((entity) => entity.id === id) ?? null;

  const reorder = (collectionId: string, itemIds: string[]) => {
    const existing = collectionItems.filter((item) => item.collectionId === collectionId);
    if (
      existing.length !== itemIds.length ||
      new Set(itemIds).size !== itemIds.length ||
      existing.some((item) => !itemIds.includes(item.id))
    ) {
      return false;
    }
    itemIds.forEach((id, index) => {
      const item = collectionItems.find((candidate) => candidate.id === id);
      if (item) item.position = index + 1;
    });
    return true;
  };

  return {
    async list(type) {
      return [...entities.get(type)!];
    },
    find,
    async findBySlug(type, slug, releaseId) {
      return (
        entities
          .get(type)!
          .find(
            (entity) =>
              entity.slug === slug &&
              (type !== "track" || !releaseId || entity.releaseId === releaseId),
          ) ?? null
      );
    },
    async create(type, input: CreateEntityInput) {
      const entity: StoredEntity = {
        id: crypto.randomUUID(),
        slug: input.slug,
        title: input.title,
        lifecycleStatus: "draft",
        scheduledFor: null,
        artistId: input.artistId,
        releaseId: input.releaseId,
      };
      entities.get(type)!.push(entity);
      return entity;
    },
    async update(type, id, input: UpdateEntityInput) {
      const entity = await find(type, id);
      if (!entity) return null;
      if (input.slug) entity.slug = input.slug;
      if (input.title) entity.title = input.title;
      return entity;
    },
    async delete(type, id) {
      const values = entities.get(type)!;
      const index = values.findIndex((entity) => entity.id === id);
      if (index < 0) return false;
      values.splice(index, 1);
      return true;
    },
    async hasReferences(type, id) {
      if (type === "artist") {
        return ["release", "track"].some((candidate) =>
          entities.get(candidate as CuratorEntityType)!.some((entity) => entity.artistId === id),
        );
      }
      return type === "release"
        ? entities.get("track")!.some((entity) => entity.releaseId === id)
        : false;
    },
    async setLifecycle(type, id, from, to, now, scheduledFor, actor, reason) {
      const entity = await find(type, id);
      if (!entity || entity.lifecycleStatus !== from) return false;
      entity.lifecycleStatus = to;
      entity.scheduledFor = to === "scheduled" ? scheduledFor : null;
      audit.unshift({
        id: crypto.randomUUID(),
        entityType: type,
        entityId: id,
        fromLifecycle: from,
        toLifecycle: to,
        actorEmail: actor.email,
        reason,
        occurredAt: now,
      });
      return true;
    },
    async addCollectionItem(collectionId: string, target: CollectionTarget) {
      collectionItems.push({
        id: crypto.randomUUID(),
        collectionId,
        trackId: target.trackId ?? null,
        releaseId: target.releaseId ?? null,
        annotation: target.annotation ?? null,
        position: collectionItems.filter((item) => item.collectionId === collectionId).length + 1,
      });
    },
    async hasCollectionTarget(collectionId, target) {
      return collectionItems.some(
        (item) =>
          item.collectionId === collectionId &&
          (target.trackId ? item.trackId === target.trackId : item.releaseId === target.releaseId),
      );
    },
    async removeCollectionItem(collectionId, itemId) {
      const index = collectionItems.findIndex(
        (item) => item.collectionId === collectionId && item.id === itemId,
      );
      if (index < 0) return false;
      collectionItems.splice(index, 1);
      const ids = collectionItems
        .filter((item) => item.collectionId === collectionId)
        .sort((left, right) => left.position - right.position)
        .map((item) => item.id);
      return reorder(collectionId, ids);
    },
    async reorderCollectionItems(collectionId, itemIds) {
      return reorder(collectionId, itemIds);
    },
    async listCollectionItems(collectionId) {
      return collectionItems
        .filter((item) => item.collectionId === collectionId)
        .sort((left, right) => left.position - right.position);
    },
    async configureCollectionHomepage(collectionId, showOnHomepage, homepagePosition) {
      const collection = await find("collection", collectionId);
      if (!collection) return false;
      collection.showOnHomepage = showOnHomepage;
      collection.homepagePosition = showOnHomepage ? homepagePosition : null;
      return true;
    },
    async homepagePositionInUse(collectionId, homepagePosition) {
      return entities
        .get("collection")!
        .some(
          (collection) =>
            collection.id !== collectionId &&
            collection.showOnHomepage &&
            collection.homepagePosition === homepagePosition,
        );
    },
    async listAudit() {
      return [...audit];
    },
    async publishScheduled(now) {
      let published = 0;
      const system = { id: "scheduled-publication", email: "system@sunstrucksynapse.com" };
      for (const [type, values] of entities) {
        const due = values.filter(
          (entity) =>
            entity.lifecycleStatus === "scheduled" &&
            entity.scheduledFor &&
            entity.scheduledFor <= now,
        );
        for (const entity of due) {
          if (
            await setLifecycle(
              type,
              entity.id,
              "scheduled",
              "published",
              now,
              null,
              system,
              "Scheduled publication",
            )
          ) {
            published += 1;
          }
        }
      }
      return published;
    },
  };
}
