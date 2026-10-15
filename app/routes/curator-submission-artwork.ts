import type { LoaderFunctionArgs } from "react-router";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { createSubmissionEditRepository } from "~/repositories/submission-edit.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { validateUuid } from "~/services/curator-validation";

// No page component: React Router must send the original image bytes rather
// than treating the loader result as data for an HTML document.
export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) return auth.response;
  if (!params.submissionId || !validateUuid(params.submissionId, "submission").ok)
    return new Response("Not found.", { status: 404 });
  if (!runtime.db || !runtime.env)
    return new Response("Artwork preview unavailable.", { status: 503 });
  const row = await createSubmissionEditRepository(runtime.db).find(params.submissionId);
  if (!row?.coverObjectKey || !row.coverMimeType)
    return new Response("Not found.", { status: 404 });
  const object = await runtime.env.MEDIA_BUCKET.get(row.coverObjectKey, { range: new Headers() });
  if (!object) return new Response("Not found.", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": row.coverMimeType,
      "content-length": String(object.size),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
