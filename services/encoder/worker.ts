import { Container } from "@cloudflare/containers";
import { STREAMING_PROFILE } from "../../app/config/music-metadata";
import { validateEncodingOutput } from "../../app/services/encoding-contract";
import type { PreparationLease } from "../../app/repositories/release-preparation.server";

export class AudioEncoder extends Container {
  defaultPort = 8080;
  sleepAfter = "2m";
}
const validUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
interface EncoderEnv {
  MEDIA_BUCKET: R2Bucket;
  ENCODERS: DurableObjectNamespace<AudioEncoder>;
}

export default {
  async fetch(request: Request, env: EncoderEnv) {
    if (request.method === "POST" && new URL(request.url).pathname === "/validate-artwork") {
      const size = Number(request.headers.get("content-length"));
      const mime = request.headers.get("content-type");
      const checksum = request.headers.get("x-source-checksum") ?? "";
      if (
        !Number.isSafeInteger(size) ||
        size < 1 ||
        size > 20 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(mime ?? "") ||
        !/^[a-f0-9]{64}$/.test(checksum)
      )
        return new Response(null, { status: 400 });
      return env.ENCODERS.getByName("primary").fetch("http://encoder/validate-artwork", {
        method: "POST",
        body: request.body,
        headers: {
          "content-type": mime!,
          "content-length": String(size),
          "x-source-checksum": checksum,
        },
        signal: AbortSignal.timeout(60_000),
      });
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== "/encode")
      return new Response(null, { status: 404 });
    let job: PreparationLease;
    try {
      job = (await request.json()) as PreparationLease;
    } catch {
      return new Response(null, { status: 400 });
    }
    if (!job || typeof job !== "object") return new Response(null, { status: 400 });
    if (
      !validUuid(job.id) ||
      !validUuid(job.leaseToken) ||
      job.outputKey !== `private/streaming-preparation/${job.id}/${job.leaseToken}.mp3` ||
      !job.sourceKey?.startsWith("private/review-audio/final/") ||
      job.profile !== STREAMING_PROFILE ||
      !/^[0-9a-f]{64}$/.test(job.sourceChecksum) ||
      !Number.isSafeInteger(job.sourceByteSize) ||
      job.sourceByteSize < 1 ||
      job.sourceByteSize > 524288000 ||
      !Number.isSafeInteger(job.sourceDurationMs) ||
      job.sourceDurationMs < 1 ||
      job.sourceDurationMs > 86400000 ||
      !["audio/wav", "audio/flac", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm"].includes(
        job.sourceMime,
      )
    )
      return new Response(null, { status: 400 });
    const source = await env.MEDIA_BUCKET.get(job.sourceKey);
    if (!source || source.size !== job.sourceByteSize) return new Response(null, { status: 409 });
    const response = await env.ENCODERS.getByName("primary").fetch("http://encoder/encode", {
      method: "POST",
      body: source.body,
      headers: {
        "content-type": job.sourceMime,
        "content-length": String(source.size),
        "x-source-checksum": job.sourceChecksum,
        "x-source-duration": String(job.sourceDurationMs),
      },
      signal: AbortSignal.timeout(9 * 60_000),
    });
    if (!response.ok || !response.body) return new Response(null, { status: 422 });
    try {
      const output = validateEncodingOutput(job, {
        ...JSON.parse(response.headers.get("x-encoding-metadata") ?? "null"),
        objectKey: job.outputKey,
      });
      const stream = new FixedLengthStream(output.byteSize);
      const transfer = new AbortController();
      let timer: ReturnType<typeof setTimeout>;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("Output storage timeout");
          transfer.abort(error);
          if (!stream.readable.locked) void stream.readable.cancel(error).catch(() => {});
          reject(error);
        }, 60000);
      });
      const pump = response.body.pipeTo(stream.writable, { signal: transfer.signal });
      const put = env.MEDIA_BUCKET.put(job.outputKey, stream.readable, {
        httpMetadata: { contentType: "audio/mpeg" },
        customMetadata: {
          checksumSha256: output.checksumSha256,
          profile: STREAMING_PROFILE,
          preparationJobId: job.id,
        },
        sha256: output.checksumSha256,
      });
      // An early R2 error must abort backpressure immediately; waiting for the
      // producer first can leave the request hanging forever.
      const checkedPut = put.catch((error) => {
        transfer.abort(error);
        if (!stream.readable.locked) void stream.readable.cancel(error).catch(() => {});
        throw error;
      });
      try {
        await Promise.race([Promise.all([pump, checkedPut]), deadline]);
      } finally {
        clearTimeout(timer!);
        transfer.abort();
      }
      if ((await env.MEDIA_BUCKET.head(job.outputKey))?.size !== output.byteSize)
        throw new Error("Output storage failure");
      return Response.json(output);
    } catch {
      await env.MEDIA_BUCKET.delete(job.outputKey).catch(() => {});
      return new Response(null, { status: 422 });
    }
  },
} satisfies ExportedHandler<EncoderEnv>;
