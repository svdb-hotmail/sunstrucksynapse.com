import { and, eq } from "drizzle-orm";
import type { LoaderFunctionArgs } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import { artworkAssets, audioAssets } from "~/db/schema";
import { verifyMediaSignature } from "~/services/media-signing";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  if (!runtime.db || !runtime.env) return new Response("Not found.", { status: 404 });
  const kind = params.kind;
  const id = params.assetId;
  if ((kind !== "artwork" && kind !== "audio") || !id) {
    return new Response("Not found.", { status: 404 });
  }
  const url = new URL(request.url);
  if (!(await verifyMediaSignature(url, runtime.env.MEDIA_DELIVERY_SIGNING_SECRET))) {
    return new Response("Link expired or invalid.", { status: 403 });
  }
  const rows =
    kind === "artwork"
      ? await runtime.db
          .select({ objectKey: artworkAssets.objectKey, mimeType: artworkAssets.mimeType })
          .from(artworkAssets)
          .where(
            and(
              eq(artworkAssets.id, id),
              eq(artworkAssets.storageProvider, "r2"),
              eq(artworkAssets.status, "ready"),
              eq(artworkAssets.scope, "publishable_derivative"),
            ),
          )
          .limit(1)
      : await runtime.db
          .select({ objectKey: audioAssets.objectKey, mimeType: audioAssets.mimeType })
          .from(audioAssets)
          .where(
            and(
              eq(audioAssets.id, id),
              eq(audioAssets.storageProvider, "r2"),
              eq(audioAssets.status, "ready"),
              eq(audioAssets.scope, "publishable_derivative"),
            ),
          )
          .limit(1);
  const asset = rows[0];
  if (!asset) return new Response("Not found.", { status: 404 });
  const object = await runtime.env.MEDIA_BUCKET.get(asset.objectKey, {
    range: request.headers,
  });
  if (!object) return new Response("Not found.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", asset.mimeType);
  headers.set("cache-control", "private, max-age=300");
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { status: object.range ? 206 : 200, headers });
}
