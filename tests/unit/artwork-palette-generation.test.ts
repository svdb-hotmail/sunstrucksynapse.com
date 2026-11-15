import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtworkPaletteSource } from "../../app/repositories/artwork-palettes.server";
import type { WorkerEnv } from "../../app/config/env.server";
import type { CurationOutboxClaimedRow } from "../../app/repositories/curation-outbox.server";
import {
  prepareNextArtworkPalette,
  processArtworkPaletteJob,
} from "../../app/services/artwork-palette-generation.server";

const repositories = vi.hoisted(() => ({ claim: vi.fn() }));
vi.mock("../../app/repositories/curation-outbox.server", () => ({
  createCurationOutboxRepository: () => repositories,
}));
const source: ArtworkPaletteSource = {
  assetId: "20000000-0000-4000-8000-000000000001",
  objectKey: "public/artwork/final/image.png",
  storageProvider: "r2" as const,
  checksumSha256: "a".repeat(64),
  mimeType: "image/png",
  byteSize: 5,
  algorithmVersion: 1 as const,
};
const colors = {
  accent: "#224466",
  paperLight: "#ffffff",
  surfaceLight: "#eeeeee",
  inkLight: "#111111",
  paperDark: "#111111",
  surfaceDark: "#222222",
  inkDark: "#ffffff",
};
const output = {
  version: 1,
  colors,
  checksumSha256: source.checksumSha256,
  byteSize: source.byteSize,
  mimeType: source.mimeType,
  width: 100,
  height: 100,
};
const job = {
  id: "30000000-0000-4000-8000-000000000001",
  leaseToken: "40000000-0000-4000-8000-000000000001",
  kind: "artwork_palette_generate",
  payload: source,
} as unknown as CurationOutboxClaimedRow;
function setup(value: unknown = output) {
  const palettes = {
    getSource: vi.fn().mockResolvedValue(source),
    persistReady: vi.fn().mockResolvedValue(true),
    persistFailed: vi.fn().mockResolvedValue(true),
  };
  const outbox = {
    acknowledge: vi.fn().mockResolvedValue(true),
    retry: vi.fn().mockResolvedValue(true),
    defer: vi.fn().mockResolvedValue(true),
    fail: vi.fn().mockResolvedValue(true),
  };
  const env = {
    AUDIO_ENCODER: { fetch: vi.fn().mockResolvedValue(Response.json(value)) },
    MEDIA_BUCKET: {
      get: vi.fn().mockImplementation(async () => ({
        size: 5,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(5));
            controller.close();
          },
        }),
        writeHttpMetadata(headers: Headers) {
          headers.set("content-type", "image/png");
        },
      })),
    },
  };
  const run = (selectedJob = job) =>
    processArtworkPaletteJob(selectedJob, env as unknown as WorkerEnv, palettes, outbox);
  return { palettes, outbox, env, run };
}
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("durable artwork palette processor", () => {
  it("never claims or spends retries without the decoder binding", async () => {
    expect(await prepareNextArtworkPalette({} as never, {} as WorkerEnv)).toEqual({
      state: "unconfigured",
    });
    expect(repositories.claim).not.toHaveBeenCalled();
  });
  it("streams only the exact DB source and stores validated colors behind CAS", async () => {
    const { run, env, palettes, outbox } = setup();
    expect(await run()).toEqual({ state: "ready" });
    expect(env.MEDIA_BUCKET.get).toHaveBeenCalledWith(source.objectKey, {
      range: expect.any(Headers),
    });
    expect(env.AUDIO_ENCODER.fetch).toHaveBeenCalledWith(
      "https://encoder.internal/artwork-palette",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "image/png",
          "content-length": "5",
          "x-source-checksum": source.checksumSha256,
        },
      }),
    );
    expect(palettes.persistReady).toHaveBeenCalledWith({
      jobId: job.id,
      leaseToken: job.leaseToken,
      source,
      colors,
    });
    expect(outbox.acknowledge).toHaveBeenCalledWith(job.id, job.leaseToken);
  });
  it("defers a busy decoder without writing failed palette or consuming an attempt", async () => {
    const { run, env, palettes, outbox } = setup();
    env.AUDIO_ENCODER.fetch.mockResolvedValue(new Response(null, { status: 409 }));
    expect(await run()).toEqual({ state: "deferred" });
    expect(outbox.defer).toHaveBeenCalledWith(job.id, job.leaseToken, "ENCODER_BUSY", 60);
    expect(outbox.retry).not.toHaveBeenCalled();
    expect(palettes.persistFailed).not.toHaveBeenCalled();
  });
  it("discards a replaced source before reading object bytes", async () => {
    const { run, env, palettes } = setup();
    palettes.getSource.mockResolvedValue({ ...source, checksumSha256: "b".repeat(64) });
    expect(await run()).toEqual({ state: "obsolete" });
    expect(env.MEDIA_BUCKET.get).not.toHaveBeenCalled();
    expect(palettes.persistReady).not.toHaveBeenCalled();
  });
  it("relies on database CAS when source replacement or lease loss occurs during decoding", async () => {
    const { run, env, palettes, outbox } = setup();
    let release!: (value: Response) => void;
    env.AUDIO_ENCODER.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const work = run();
    await vi.waitFor(() => expect(env.AUDIO_ENCODER.fetch).toHaveBeenCalled());
    palettes.persistReady.mockResolvedValue(false);
    release(Response.json(output));
    expect(await work).toEqual({ state: "obsolete" });
    expect(palettes.persistFailed).not.toHaveBeenCalled();
    expect(outbox.retry).not.toHaveBeenCalled();
  });
  it.each([
    { checksumSha256: "b".repeat(64) },
    { mimeType: "image/jpeg" },
    { byteSize: 6 },
    { version: 2 },
    { width: 10001 },
    { colors: { ...colors, accent: "var(--danger)" } },
  ])("rejects altered decoder provenance or unsafe colors %j", async (patch) => {
    const { run, palettes, outbox } = setup({ ...output, ...patch });
    expect(await run()).toEqual({ state: "failed", code: "INVALID_DECODER_OUTPUT" });
    expect(palettes.persistReady).not.toHaveBeenCalled();
    expect(outbox.retry).toHaveBeenCalledWith(job.id, job.leaseToken, "INVALID_DECODER_OUTPUT", 60);
  });
  it("records static legacy sources as unavailable without fetching a URL", async () => {
    const { run, env, palettes, outbox } = setup();
    const staticSource = {
      ...source,
      storageProvider: "static" as const,
      objectKey: "/assets/image.png",
    };
    palettes.getSource.mockResolvedValue(staticSource);
    expect(await run({ ...job, payload: staticSource })).toEqual({
      state: "failed",
      code: "SOURCE_UNAVAILABLE",
    });
    expect(env.MEDIA_BUCKET.get).not.toHaveBeenCalled();
    expect(env.AUDIO_ENCODER.fetch).not.toHaveBeenCalled();
    expect(outbox.fail).toHaveBeenCalledWith(job.id, job.leaseToken, "SOURCE_UNAVAILABLE");
  });
  it("never replaces an uncertain committed ready result with failed", async () => {
    const { run, palettes, outbox } = setup();
    palettes.persistReady.mockRejectedValue(new Error("response lost"));
    expect(await run()).toEqual({ state: "failed", code: "COMPLETION_UNCERTAIN" });
    expect(palettes.persistFailed).not.toHaveBeenCalled();
    expect(outbox.retry).toHaveBeenCalledWith(job.id, job.leaseToken, "COMPLETION_UNCERTAIN", 60);
  });
  it("records unsupported legacy SVG as a terminal generation failure", async () => {
    const { run, env, palettes, outbox } = setup();
    const svgSource = { ...source, mimeType: "image/svg+xml", storageProvider: "static" as const };
    palettes.getSource.mockResolvedValue(svgSource);
    expect(await run({ ...job, payload: svgSource })).toEqual({
      state: "failed",
      code: "UNSUPPORTED_MIME_TYPE",
    });
    expect(palettes.persistFailed).toHaveBeenCalledWith(
      expect.objectContaining({ source: svgSource, errorCode: "UNSUPPORTED_MIME_TYPE" }),
    );
    expect(outbox.fail).toHaveBeenCalledWith(job.id, job.leaseToken, "UNSUPPORTED_MIME_TYPE");
    expect(env.MEDIA_BUCKET.get).not.toHaveBeenCalled();
  });
  it("bounds a stalled storage read and cancels its late body", async () => {
    // AbortSignal.timeout is native, so inject its signal to control the clock explicitly.
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const { run, env, palettes } = setup();
    let resolve!: (value: Awaited<ReturnType<typeof env.MEDIA_BUCKET.get>>) => void;
    env.MEDIA_BUCKET.get.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const work = run();
    await vi.waitFor(() => expect(env.MEDIA_BUCKET.get).toHaveBeenCalled());
    controller.abort();
    expect(await work).toEqual({ state: "failed", code: "DECODER_TIMEOUT" });
    const cancel = vi.fn();
    resolve({
      size: 5,
      body: new ReadableStream({ cancel }),
      writeHttpMetadata(headers: Headers) {
        headers.set("content-type", "image/png");
      },
    });
    await vi.waitFor(() => expect(cancel).toHaveBeenCalled());
    expect(palettes.persistReady).not.toHaveBeenCalled();
    timeout.mockRestore();
  });
  it("caps decoder JSON and never stores an oversized payload", async () => {
    const { run, env, palettes } = setup();
    env.AUDIO_ENCODER.fetch.mockResolvedValue(new Response("x".repeat(4097)));
    expect((await run()).state).toBe("failed");
    expect(palettes.persistReady).not.toHaveBeenCalled();
  });
});
