import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../app/config/env.server";
import { STREAMING_PROFILE } from "../../app/config/music-metadata";
import { prepareNextRelease } from "../../app/services/release-preparation.server";
const repository = vi.hoisted(() => ({ claim: vi.fn(), complete: vi.fn(), fail: vi.fn() }));
vi.mock("../../app/repositories/release-preparation.server", () => ({
  createReleasePreparationRepository: () => repository,
}));
const job = {
  id: "job",
  trackId: "track",
  leaseToken: "lease",
  sourceKey: "private/review-audio/final/source",
  sourceChecksum: "a".repeat(64),
  sourceByteSize: 100,
  sourceDurationMs: 180000,
  sourceMime: "audio/flac",
  outputKey: "private/streaming-preparation/job/lease.mp3",
  profile: STREAMING_PROFILE,
};
const output = {
  objectKey: job.outputKey,
  profile: STREAMING_PROFILE,
  checksumSha256: "b".repeat(64),
  byteSize: 7200000,
  durationMs: 180000,
  sampleRate: 44100,
  channels: 2,
  bitRate: 320000,
};
function environment(value: unknown = output) {
  return {
    AUDIO_ENCODER: { fetch: vi.fn().mockResolvedValue(Response.json(value)) },
    MEDIA_BUCKET: {
      head: vi.fn().mockResolvedValue({
        size: output.byteSize,
        customMetadata: { checksumSha256: output.checksumSha256 },
      }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  repository.claim.mockResolvedValue(job);
  repository.complete.mockResolvedValue(true);
  repository.fail.mockResolvedValue(undefined);
});
describe("durable streaming preparation", () => {
  it("preserves queued work and all retries when the encoder is unconfigured", async () => {
    expect(await prepareNextRelease({} as never, {} as WorkerEnv)).toEqual({
      state: "unconfigured",
    });
    expect(repository.claim).not.toHaveBeenCalled();
  });
  it("sends the accepted source and completes only a stored verified derivative", async () => {
    const env = environment();
    expect(await prepareNextRelease({} as never, env as unknown as WorkerEnv)).toEqual({
      state: "ready",
    });
    expect(JSON.parse(env.AUDIO_ENCODER.fetch.mock.calls[0][1].body)).toEqual(job);
    expect(env.MEDIA_BUCKET.head).toHaveBeenCalledWith(job.outputKey);
    expect(repository.complete).toHaveBeenCalledWith(job, output);
    expect(repository.fail).not.toHaveBeenCalled();
  });
  it.each([
    { objectKey: job.sourceKey },
    { channels: 1 },
    { sampleRate: 48000 },
    { bitRate: 128000 },
    { durationMs: 1000 },
    { profile: "unversioned" },
    { checksumSha256: "invalid" },
  ])("rejects a changed source/output contract: %j", async (patch) => {
    const env = environment({ ...output, ...patch });
    expect(await prepareNextRelease({} as never, env as unknown as WorkerEnv)).toEqual({
      state: "failed",
      code: "OUTPUT_VERIFICATION_FAILED",
    });
    expect(repository.complete).not.toHaveBeenCalled();
    expect(env.MEDIA_BUCKET.delete).toHaveBeenCalledWith(job.outputKey);
    expect(env.MEDIA_BUCKET.delete).not.toHaveBeenCalledWith(job.sourceKey);
  });
  it("does not trust a provider response without the stored size and checksum", async () => {
    const env = environment();
    env.MEDIA_BUCKET.head.mockResolvedValueOnce({
      size: output.byteSize,
      customMetadata: { checksumSha256: "0".repeat(64) },
    });
    expect(await prepareNextRelease({} as never, env as unknown as WorkerEnv)).toEqual({
      state: "failed",
      code: "OUTPUT_STORAGE_MISMATCH",
    });
    expect(repository.complete).not.toHaveBeenCalled();
  });
  it("cleans only an obsolete attempt when a newer lease has won", async () => {
    repository.complete.mockResolvedValue(false);
    const env = environment();
    expect(await prepareNextRelease({} as never, env as unknown as WorkerEnv)).toEqual({
      state: "failed",
      code: "LEASE_LOST",
    });
    expect(env.MEDIA_BUCKET.delete.mock.calls).toEqual([[job.outputKey]]);
    expect(repository.fail).toHaveBeenCalledWith(job, "LEASE_LOST");
  });
  it("retains the potentially selected derivative when the completion response is lost", async () => {
    repository.complete.mockRejectedValueOnce(new Error("Database response lost"));
    const env = environment();
    expect(await prepareNextRelease({} as never, env as unknown as WorkerEnv)).toEqual({
      state: "failed",
      code: "PREPARATION_INTERRUPTED",
    });
    expect(env.MEDIA_BUCKET.delete).not.toHaveBeenCalled();
  });
});
