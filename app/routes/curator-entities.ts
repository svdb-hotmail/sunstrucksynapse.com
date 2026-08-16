import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import {
  createCuratorRepository,
  type CuratorEntityType,
  type Lifecycle,
} from "~/repositories/curator.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { CuratorService, curatorHttpStatus } from "~/services/curator.server";

const entityTypes = new Set<CuratorEntityType>(["artist", "release", "track", "collection"]);
const lifecycles = new Set<Lifecycle>(["draft", "in_review", "scheduled", "published", "archived"]);

function typeFrom(params: Readonly<Record<string, string | undefined>>): CuratorEntityType | null {
  const value = params.entityType;
  return value && entityTypes.has(value as CuratorEntityType) ? (value as CuratorEntityType) : null;
}

async function authorized(request: Request, context: LoaderFunctionArgs["context"]) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (auth.ok) runtime.identity = auth.identity;
  return { runtime, auth };
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const { runtime, auth } = await authorized(request, context);
  if (!auth.ok) return auth.response;
  const type = typeFrom(params);
  const repository =
    runtime.curatorRepository ?? (runtime.db ? createCuratorRepository(runtime.db) : null);
  if (!type || !repository) return Response.json({ error: "Not found." }, { status: 404 });
  const service = new CuratorService(repository);
  return Response.json(await service.list(type));
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const { runtime, auth } = await authorized(request, context);
  if (!auth.ok) return auth.response;
  const type = typeFrom(params);
  const repository =
    runtime.curatorRepository ?? (runtime.db ? createCuratorRepository(runtime.db) : null);
  if (!type || !repository) return Response.json({ error: "Not found." }, { status: 404 });
  const service = new CuratorService(repository);
  let payload: unknown = {};
  if (request.method !== "DELETE") {
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
  }
  if (typeof payload !== "object" || payload === null) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const operation = Reflect.get(payload, "operation");
  const id = params.entityId;
  let result;
  if (request.method === "POST" && !id) {
    result = await service.create(type, {
      slug: String(Reflect.get(payload, "slug") ?? ""),
      title: String(Reflect.get(payload, "title") ?? ""),
      artistId:
        typeof Reflect.get(payload, "artistId") === "string"
          ? Reflect.get(payload, "artistId")
          : undefined,
      releaseId:
        typeof Reflect.get(payload, "releaseId") === "string"
          ? Reflect.get(payload, "releaseId")
          : undefined,
      position:
        typeof Reflect.get(payload, "position") === "number"
          ? Reflect.get(payload, "position")
          : undefined,
    });
  } else if (request.method === "PATCH" && id && operation === "transition") {
    const to = Reflect.get(payload, "to");
    if (typeof to !== "string" || !lifecycles.has(to as Lifecycle)) {
      return Response.json({ error: "Invalid lifecycle." }, { status: 400 });
    }
    const scheduled = Reflect.get(payload, "scheduledFor");
    result = await service.transition(type, id, to as Lifecycle, auth.identity, {
      reason:
        typeof Reflect.get(payload, "reason") === "string"
          ? Reflect.get(payload, "reason")
          : undefined,
      scheduledFor: typeof scheduled === "string" ? new Date(scheduled) : undefined,
    });
  } else if (
    request.method === "PATCH" &&
    type === "collection" &&
    id &&
    operation === "add_item"
  ) {
    result = await service.addCollectionItem(id, {
      trackId:
        typeof Reflect.get(payload, "trackId") === "string"
          ? Reflect.get(payload, "trackId")
          : undefined,
      releaseId:
        typeof Reflect.get(payload, "releaseId") === "string"
          ? Reflect.get(payload, "releaseId")
          : undefined,
      annotation:
        typeof Reflect.get(payload, "annotation") === "string"
          ? Reflect.get(payload, "annotation")
          : null,
    });
  } else if (request.method === "PATCH" && type === "collection" && id && operation === "reorder") {
    const itemIds = Reflect.get(payload, "itemIds");
    if (!Array.isArray(itemIds) || !itemIds.every((itemId) => typeof itemId === "string")) {
      return Response.json({ error: "A complete item order is required." }, { status: 400 });
    }
    result = await service.reorderCollection(id, itemIds);
  } else if (request.method === "PATCH" && id) {
    result = await service.update(type, id, {
      slug:
        typeof Reflect.get(payload, "slug") === "string" ? Reflect.get(payload, "slug") : undefined,
      title:
        typeof Reflect.get(payload, "title") === "string"
          ? Reflect.get(payload, "title")
          : undefined,
    });
  } else if (request.method === "DELETE" && id) {
    result = await service.delete(type, id);
  } else {
    return new Response("Method not allowed.", { status: 405 });
  }
  if (result.ok)
    return Response.json(result.value, { status: request.method === "POST" ? 201 : 200 });
  const status = curatorHttpStatus(result.error.code);
  return Response.json({ error: result.error.message, code: result.error.code }, { status });
}
