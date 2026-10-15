import { STREAMING_PROFILE } from "../../app/config/music-metadata";
import { validateEncodingOutput } from "../../app/services/encoding-contract";
import type { PreparationLease } from "../../app/repositories/release-preparation.server";

interface VerificationEnv {
  MEDIA_BUCKET: R2Bucket;
  AUDIO_ENCODER: Fetcher;
  VERIFICATION_RUN: string;
  BUCKET_PURPOSE: string;
}

/** One second of generated PCM; this probe never reads any artist recording. */
function syntheticWav() {
  const samples = 44100;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, samples, true);
  view.setUint32(28, samples * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++)
    view.setInt16(44 + i * 2, Math.round(Math.sin((i * 2 * Math.PI * 440) / samples) * 4096), true);
  return bytes;
}

async function checksum(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyEncoder(env: VerificationEnv) {
  if (
    env.BUCKET_PURPOSE !== "isolated-synthetic-verification" ||
    !/^\d{8}-\d{2}$/.test(env.VERIFICATION_RUN)
  )
    throw new Error("Verification must use the explicit isolated configuration");
  const resultKey = `private/encoder-verification/${env.VERIFICATION_RUN}/result.json`;
  const marker = await env.MEDIA_BUCKET.put(resultKey, JSON.stringify({ status: "running" }), {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json" },
  });
  // An explicit new run ID is required to retry; cron cannot repeatedly spend on a failed run.
  if (!marker) return;
  try {
    const source = syntheticWav();
    const sourceChecksum = await checksum(source);
    const id = crypto.randomUUID();
    const leaseToken = crypto.randomUUID();
    const job: PreparationLease = {
      id,
      trackId: crypto.randomUUID(),
      leaseToken,
      sourceKey: `private/review-audio/final/verification-${env.VERIFICATION_RUN}.wav`,
      sourceChecksum,
      sourceByteSize: source.byteLength,
      sourceMime: "audio/wav",
      sourceDurationMs: 1000,
      outputKey: `private/streaming-preparation/${id}/${leaseToken}.mp3`,
      profile: STREAMING_PROFILE,
    };
    await env.MEDIA_BUCKET.put(job.sourceKey, source, {
      sha256: sourceChecksum,
      httpMetadata: { contentType: "audio/wav" },
    });
    const response = await env.AUDIO_ENCODER.fetch("https://encoder/encode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(job),
    });
    if (!response.ok) throw new Error(`Encoder returned ${response.status}`);
    const output = validateEncodingOutput(job, await response.json());
    const stored = await env.MEDIA_BUCKET.get(job.outputKey);
    if (
      !stored ||
      stored.size !== output.byteSize ||
      stored.httpMetadata?.contentType !== "audio/mpeg" ||
      stored.customMetadata?.profile !== STREAMING_PROFILE ||
      (await checksum(await stored.arrayBuffer())) !== output.checksumSha256
    )
      throw new Error("Stored derivative verification failed");
    const original = await env.MEDIA_BUCKET.get(job.sourceKey);
    if (!original || (await checksum(await original.arrayBuffer())) !== sourceChecksum)
      throw new Error("Source preservation verification failed");
    const rejectedLease = crypto.randomUUID();
    const rejectedKey = `private/streaming-preparation/${id}/${rejectedLease}.mp3`;
    const rejection = await env.AUDIO_ENCODER.fetch("https://encoder/encode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...job,
        leaseToken: rejectedLease,
        outputKey: rejectedKey,
        sourceChecksum: "0".repeat(64),
      }),
    });
    if (rejection.ok || (await env.MEDIA_BUCKET.head(rejectedKey)))
      throw new Error("Wrong source checksum was not rejected");
    const result = {
      event: "sunsyn.encoder.verification",
      run: env.VERIFICATION_RUN,
      status: "passed",
      profile: output.profile,
      byteSize: output.byteSize,
      durationMs: output.durationMs,
      sampleRate: output.sampleRate,
      channels: output.channels,
      bitRate: output.bitRate,
      storedChecksumVerified: true,
      sourcePreserved: true,
      wrongSourceRejected: true,
    };
    await env.MEDIA_BUCKET.put(resultKey, JSON.stringify(result), {
      httpMetadata: { contentType: "application/json" },
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    const result = {
      event: "sunsyn.encoder.verification",
      run: env.VERIFICATION_RUN,
      status: "failed",
      error: error instanceof Error ? error.message : "Provider verification failed",
    };
    await env.MEDIA_BUCKET.put(resultKey, JSON.stringify(result), {
      httpMetadata: { contentType: "application/json" },
    });
    console.error(JSON.stringify(result));
    throw error;
  }
}

export default {
  fetch() {
    return new Response(null, { status: 404 });
  },
  async scheduled(_controller, env) {
    await verifyEncoder(env);
  },
} satisfies ExportedHandler<VerificationEnv>;
