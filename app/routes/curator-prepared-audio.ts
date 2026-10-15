import type { LoaderFunctionArgs } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import { createReleasePreparationRepository } from "~/repositories/release-preparation.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";

import { invalidRange } from "~/services/private-media-range";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) return auth.response;
  if (!runtime.db || !runtime.env)
    return new Response("Streaming preview unavailable.", { status: 503 });
  const audioId = params.trackId ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(audioId)) {
    return new Response("Streaming preview unavailable.", { status: 404 });
  }
  const audio = await createReleasePreparationRepository(runtime.db).audioForCurator(audioId);
  if (!audio) return new Response("Streaming preview unavailable.", { status: 404 });
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
  if (!object) return new Response("Streaming preview unavailable.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", audio.mimeType);
  const safeFilename = audio.filename.replace(/[^a-zA-Z0-9._ -]/g, "_");
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
