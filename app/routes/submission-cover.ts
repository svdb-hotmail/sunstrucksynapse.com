import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { createReleaseIntakeRepository } from "~/repositories/release-intake.server";
import { SubmissionCoverService, validateCover } from "~/services/submission-cover.server";
import { validateUuid } from "~/services/curator-validation";
import { sha256Hex } from "~/services/submission-security.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";

export async function action({ request, context, params }: ActionFunctionArgs) {
  const { db, env, rateLimitRepository } = context.get(cloudflareContext);
  if (!db || !env || !rateLimitRepository)
    return Response.json({ error: "Cover upload unavailable." }, { status: 503 });
  if (!params.invitationToken) {
    const auth = await requireCuratorIdentity(request, env);
    return auth.ok ? new Response(null, { status: 405 }) : auth.response;
  }
  const tokenHash = sha256Hex(params.invitationToken);
  if (!(await rateLimitRepository.consume("review_audio", tokenHash, 20, 300)).allowed)
    return Response.json({ error: "Wait before retrying the cover upload." }, { status: 429 });
  if (request.method !== "POST") return new Response(null, { status: 405 });
  try {
    const service = new SubmissionCoverService(db, env);
    if (params.coverId) {
      if (!validateUuid(params.coverId, "cover").ok) throw new Error("Invalid cover upload.");
      return Response.json(await service.finalize(tokenHash, params.coverId));
    }
    return Response.json(await service.create(tokenHash, validateCover(await request.json())));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && !("query" in error)
            ? error.message
            : "Could not save the cover. Reload and retry.",
      },
      { status: 409 },
    );
  }
}
export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const { db, env } = context.get(cloudflareContext);
  if (!db || !env || !validateUuid(params.coverId ?? "", "cover").ok)
    throw new Response("Not found.", { status: 404 });
  if (!params.invitationToken) {
    const auth = await requireCuratorIdentity(request, env);
    if (!auth.ok) throw auth.response;
  }
  const cover = await createReleaseIntakeRepository(db).findCover(
    params.coverId!,
    params.invitationToken ? sha256Hex(params.invitationToken) : undefined,
  );
  if (!cover?.objectKey) throw new Response("Not found.", { status: 404 });
  const object = await env.MEDIA_BUCKET.get(cover.objectKey, { range: new Headers() });
  if (!object) throw new Response("Not found.", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": cover.mimeType,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
