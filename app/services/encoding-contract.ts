import { STREAMING_PROFILE } from "../config/music-metadata";
import type { EncodingOutput, PreparationLease } from "../repositories/release-preparation.server";

export function validateEncodingOutput(job: PreparationLease, value: unknown): EncodingOutput {
  const output = value as EncodingOutput | null;
  if (
    !output ||
    output.profile !== STREAMING_PROFILE ||
    output.objectKey !== job.outputKey ||
    !/^[0-9a-f]{64}$/.test(output.checksumSha256) ||
    !Number.isSafeInteger(output.byteSize) ||
    output.byteSize <= 0 ||
    output.byteSize > 500 * 1024 * 1024 ||
    !Number.isSafeInteger(output.durationMs) ||
    output.durationMs < 1 ||
    Math.abs(output.durationMs - job.sourceDurationMs) >
      Math.max(1500, job.sourceDurationMs * 0.01) ||
    output.sampleRate !== 44100 ||
    output.channels !== 2 ||
    output.bitRate !== 320000
  )
    throw new Error("OUTPUT_VERIFICATION_FAILED");
  return output;
}
