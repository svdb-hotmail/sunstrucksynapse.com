import type { LoaderFunctionArgs } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import { createSignedMediaPath, verifyMediaSignature } from "~/services/media-signing";
import { invalidRange } from "~/services/private-media-range";
import { SHARE_PREVIEW_TYPE, trackSharePreview } from "~/services/track-share-preview";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const { catalogueRepository, env } = context.get(cloudflareContext);
  const headers = new Headers({ "cache-control": "private, no-store" });
  const unavailable = () => new Response(null, { status: 404, headers });
  if (
    !env ||
    !params.releaseSlug ||
    !params.trackSlug ||
    !/^[a-f0-9]{64}\.mp4$/.test(params.previewFile ?? "")
  ) {
    return unavailable();
  }
  const url = new URL(request.url);
  const signed = url.searchParams.has("signature");
  const secret = env.MEDIA_DELIVERY_SIGNING_SECRET;
  if (signed && !(await verifyMediaSignature(url, secret))) {
    return new Response(null, { status: 403, headers });
  }

  const track = await catalogueRepository.findPublishedTrack(params.releaseSlug, params.trackSlug);
  const preview = track && (await trackSharePreview(track.item));
  if (!preview || params.previewFile !== preview.file) return unavailable();

  const range = request.method === "HEAD" ? null : request.headers.get("range");
  const bucket = env.MEDIA_BUCKET;
  if (!signed || request.method === "HEAD" || range) {
    const metadata = await bucket.head(preview.key);
    if (!metadata?.size || metadata.httpMetadata?.contentType !== SHARE_PREVIEW_TYPE) {
      return unavailable();
    }
    if (!signed) {
      headers.set("location", await createSignedMediaPath(url.pathname, secret));
      return new Response(null, { status: 307, headers });
    }
    if (invalidRange(range, metadata.size)) {
      headers.set("content-range", `bytes */${metadata.size}`);
      return new Response(null, { status: 416, headers });
    }
    if (request.method === "HEAD") {
      setVideoHeaders(headers, metadata.size);
      return new Response(null, { headers });
    }
  }

  const object = await bucket.get(preview.key, {
    range: range ? new Headers({ range }) : new Headers(),
  });
  if (!object) return unavailable();

  const deliveredRange = range ? object.range : undefined;
  setVideoHeaders(headers, deliveredRange?.length ?? object.size);
  headers.set("etag", object.httpEtag);
  if (deliveredRange) {
    const { offset, length } = deliveredRange;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
  }
  return new Response(object.body, { status: deliveredRange ? 206 : 200, headers });
}

function setVideoHeaders(headers: Headers, length: number) {
  headers.set("content-type", SHARE_PREVIEW_TYPE);
  headers.set("content-length", String(length));
  headers.set("content-disposition", "inline");
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");
}
