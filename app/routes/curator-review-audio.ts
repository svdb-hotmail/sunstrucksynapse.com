import type { LoaderFunctionArgs } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import { createCurationWorkflowRepository } from "~/repositories/curation-workflow.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";

function invalidRange(range: string | null, size: number): boolean {
  if (!range) return false;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return true;
  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if (
    (start !== null && !Number.isSafeInteger(start)) ||
    (end !== null && !Number.isSafeInteger(end))
  )
    return true;
  if (start !== null && start >= size) return true;
  return start !== null && end !== null && end < start;
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) return auth.response;
  if (!runtime.db || !runtime.env)
    return new Response("Review audio unavailable.", { status: 503 });
  const audioId = params.audioId ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(audioId)) {
    return new Response("Review audio unavailable.", { status: 404 });
  }
  const audio = await createCurationWorkflowRepository(runtime.db).audioForCurator(audioId);
  if (!audio) return new Response("Review audio unavailable.", { status: 404 });
  const rangeHeader = request.headers.get("range");
  if (invalidRange(rangeHeader, audio.byteSize)) {
    return new Response(null, {
      status: 416,
      headers: {
        "content-range": `bytes */${audio.byteSize}`,
        "cache-control": "private, no-store",
      },
    });
  }
  const object = await runtime.env.MEDIA_BUCKET.get(audio.objectKey, { range: request.headers });
  if (!object) return new Response("Review audio unavailable.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", audio.mimeType);
  const safeFilename = audio.originalFilename.replace(/[^a-zA-Z0-9._ -]/g, "_");
  headers.set("content-disposition", `inline; filename="${safeFilename}"`);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  if (object.range) {
    const end = object.range.offset + object.range.length - 1;
    headers.set("content-range", `bytes ${object.range.offset}-${end}/${audio.byteSize}`);
    headers.set("content-length", String(object.range.length));
  } else {
    headers.set("content-length", String(audio.byteSize));
  }
  return new Response(object.body, { status: object.range ? 206 : 200, headers });
}
