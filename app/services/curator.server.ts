import type {
  CollectionTarget,
  CreateEntityInput,
  CuratorEntity,
  CuratorEntityType,
  CuratorRepository,
  Lifecycle,
  UpdateEntityInput,
} from "~/repositories/curator.server";
import type { CuratorIdentity } from "~/types/curator";

export type CuratorErrorCode =
  | "conflict"
  | "invalid"
  | "not_found"
  | "referenced"
  | "transition_conflict";

export type CuratorResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: CuratorErrorCode; message: string } };

export function curatorHttpStatus(code: CuratorErrorCode): number {
  switch (code) {
    case "not_found":
      return 404;
    case "conflict":
    case "referenced":
    case "transition_conflict":
      return 409;
    case "invalid":
    default:
      return 400;
  }
}

const transitions: Readonly<Record<Lifecycle, readonly Lifecycle[]>> = {
  draft: ["in_review"],
  in_review: ["scheduled"],
  scheduled: ["published"],
  published: ["archived"],
  archived: [],
};

export class CuratorService {
  constructor(
    private readonly repository: CuratorRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  list(type: CuratorEntityType): Promise<CuratorEntity[]> {
    return this.repository.list(type);
  }

  async create(
    type: CuratorEntityType,
    input: CreateEntityInput,
  ): Promise<CuratorResult<CuratorEntity>> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.title.trim().length === 0) {
      return {
        ok: false,
        error: { code: "invalid", message: "A valid slug and title are required." },
      };
    }
    if (type === "track") {
      if (!input.releaseId || !input.artistId || !input.position || input.position < 1) {
        return {
          ok: false,
          error: {
            code: "invalid",
            message: "A track requires a release, artist, and positive position.",
          },
        };
      }
      if (!(await this.repository.find("release", input.releaseId))) {
        return {
          ok: false,
          error: { code: "not_found", message: "The selected release no longer exists." },
        };
      }
      if (await this.repository.findBySlug("track", input.slug, input.releaseId)) {
        return {
          ok: false,
          error: { code: "conflict", message: "The track slug is already in use." },
        };
      }
    } else {
      if (await this.repository.findBySlug(type, input.slug)) {
        return {
          ok: false,
          error: { code: "conflict", message: `The ${type} slug is already in use.` },
        };
      }
    }
    if ((type === "release" || type === "track") && !input.artistId) {
      return {
        ok: false,
        error: { code: "invalid", message: `A ${type} requires a primary artist.` },
      };
    }
    if (
      (type === "release" || type === "track") &&
      input.artistId &&
      !(await this.repository.find("artist", input.artistId))
    ) {
      return {
        ok: false,
        error: { code: "not_found", message: "The selected artist no longer exists." },
      };
    }
    return {
      ok: true,
      value: await this.repository.create(type, { ...input, title: input.title.trim() }),
    };
  }

  async update(
    type: CuratorEntityType,
    id: string,
    input: UpdateEntityInput,
  ): Promise<CuratorResult<CuratorEntity>> {
    if (input.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
      return {
        ok: false,
        error: { code: "invalid", message: "Use a valid lowercase slug." },
      };
    }
    if (input.title !== undefined && input.title.trim().length === 0) {
      return {
        ok: false,
        error: { code: "invalid", message: "A title is required." },
      };
    }
    const current = await this.repository.find(type, id);
    if (!current) {
      return {
        ok: false,
        error: { code: "not_found", message: `The ${type} no longer exists.` },
      };
    }
    if (input.slug) {
      const duplicate =
        type === "track" && current.releaseId
          ? await this.repository.findBySlug(type, input.slug, current.releaseId)
          : await this.repository.findBySlug(type, input.slug);
      if (duplicate && duplicate.id !== id) {
        return {
          ok: false,
          error: { code: "conflict", message: `The ${type} slug is already in use.` },
        };
      }
    }
    const value = await this.repository.update(type, id, {
      ...input,
      title: input.title?.trim(),
    });
    return value
      ? { ok: true, value }
      : { ok: false, error: { code: "not_found", message: `The ${type} no longer exists.` } };
  }

  async delete(type: CuratorEntityType, id: string): Promise<CuratorResult<null>> {
    const entity = await this.repository.find(type, id);
    if (!entity) {
      return {
        ok: false,
        error: { code: "not_found", message: `The ${type} no longer exists.` },
      };
    }
    if (entity.lifecycleStatus !== "draft" && entity.lifecycleStatus !== "archived") {
      return {
        ok: false,
        error: {
          code: "invalid",
          message: "Only draft or archived records can be deleted.",
        },
      };
    }
    if (await this.repository.hasReferences(type, id)) {
      return {
        ok: false,
        error: {
          code: "referenced",
          message:
            type === "artist"
              ? "Remove this artist's release and track credits before deleting it."
              : type === "release"
                ? "Move or delete this release's tracks and collection entries before deleting it."
                : "Remove this track from collections and managed media before deleting it.",
        },
      };
    }
    return (await this.repository.delete(type, id))
      ? { ok: true, value: null }
      : { ok: false, error: { code: "not_found", message: `The ${type} no longer exists.` } };
  }

  async transition(
    type: CuratorEntityType,
    id: string,
    to: Lifecycle,
    actor: CuratorIdentity,
    options: { reason?: string; scheduledFor?: Date } = {},
  ): Promise<CuratorResult<CuratorEntity>> {
    const entity = await this.repository.find(type, id);
    if (!entity)
      return { ok: false, error: { code: "not_found", message: `The ${type} no longer exists.` } };
    if (!transitions[entity.lifecycleStatus].includes(to)) {
      return {
        ok: false,
        error: { code: "invalid", message: `Cannot move ${entity.lifecycleStatus} to ${to}.` },
      };
    }
    const reason = options.reason?.trim() || null;
    if ((to === "published" || to === "archived") && !reason) {
      return {
        ok: false,
        error: { code: "invalid", message: "Publishing and archiving require a reason." },
      };
    }
    const now = this.clock();
    const scheduledFor = options.scheduledFor ?? null;
    if (
      to === "scheduled" &&
      (!scheduledFor || Number.isNaN(scheduledFor.getTime()) || scheduledFor <= now)
    ) {
      return {
        ok: false,
        error: { code: "invalid", message: "Choose a future publication time." },
      };
    }
    const changed = await this.repository.setLifecycle(
      type,
      id,
      entity.lifecycleStatus,
      to,
      now,
      scheduledFor,
      actor,
      reason,
    );
    if (!changed) {
      return {
        ok: false,
        error: {
          code: "transition_conflict",
          message: "This item changed; reload before trying again.",
        },
      };
    }
    const value = await this.repository.find(type, id);
    return value
      ? { ok: true, value }
      : { ok: false, error: { code: "not_found", message: `The ${type} no longer exists.` } };
  }

  async addCollectionItem(
    collectionId: string,
    target: CollectionTarget,
  ): Promise<CuratorResult<null>> {
    if (!(await this.repository.find("collection", collectionId))) {
      return {
        ok: false,
        error: { code: "not_found", message: "The collection no longer exists." },
      };
    }
    if (Boolean(target.trackId) === Boolean(target.releaseId)) {
      return {
        ok: false,
        error: { code: "invalid", message: "Select exactly one track or release." },
      };
    }
    const targetType = target.trackId ? "track" : "release";
    const targetId = target.trackId ?? target.releaseId;
    if (!targetId || !(await this.repository.find(targetType, targetId))) {
      return {
        ok: false,
        error: { code: "not_found", message: "The selected collection item no longer exists." },
      };
    }
    if (await this.repository.hasCollectionTarget(collectionId, target)) {
      return {
        ok: false,
        error: { code: "conflict", message: "That item is already in this collection." },
      };
    }
    await this.repository.addCollectionItem(collectionId, target);
    return { ok: true, value: null };
  }

  async reorderCollection(collectionId: string, itemIds: string[]): Promise<CuratorResult<null>> {
    return (await this.repository.reorderCollectionItems(collectionId, itemIds))
      ? { ok: true, value: null }
      : {
          ok: false,
          error: { code: "invalid", message: "The collection changed; reload before reordering." },
        };
  }

  publishScheduled(): Promise<number> {
    return this.repository.publishScheduled(this.clock());
  }
}
