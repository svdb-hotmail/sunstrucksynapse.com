import type { ActionFunctionArgs } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { MediaService, parseUploadDeclaration } from "~/services/media.server";

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) return auth.response;
  if (!runtime.db || !runtime.env) return json({ error: "Service unavailable." }, 503);
  runtime.identity = auth.identity;
  const service = new MediaService(runtime.db, runtime.env);

  if (request.method === "POST" && !params.sessionId) {
    const declaration = parseUploadDeclaration(await request.json());
    if (!declaration.ok) return json({ error: declaration.message }, declaration.status);
    const result = await service.createSession(declaration.value, auth.identity);
    return result.ok ? json(result.value, 201) : json({ error: result.message }, result.status);
  }
  if (!params.sessionId) return json({ error: "Upload session required." }, 400);
  if (request.method === "PUT") {
    const result = await service.upload(params.sessionId, request);
    return result.ok
      ? new Response(null, { status: 204 })
      : json({ error: result.message }, result.status);
  }
  if (request.method === "PATCH") {
    const result = await service.complete(params.sessionId);
    return result.ok ? json(result.value) : json({ error: result.message }, result.status);
  }
  if (request.method === "DELETE") {
    const count = await service.cleanupAbandoned();
    return json({ cleaned: count });
  }
  return new Response("Method not allowed.", { status: 405 });
}
