import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const localDecoder = vi.hoisted(() => ({ execFile: vi.fn(), invoke: vi.fn() }));
vi.mock("node:child_process", () => ({
  execFile: Object.assign(localDecoder.execFile, {
    [Symbol.for("nodejs.util.promisify.custom")]: localDecoder.invoke,
  }),
}));

import type { ArtworkPaletteBackfillRow } from "../../app/repositories/artwork-palettes.server";
import {
  createStaticArtworkPaletteProcessor,
  decodeStaticArtwork,
} from "../../app/services/artwork-palette-static-backfill.server";

const colors = {
  accent: "#224466",
  paperLight: "#ffffff",
  surfaceLight: "#eeeeee",
  inkLight: "#111111",
  paperDark: "#111111",
  surfaceDark: "#222222",
  inkDark: "#ffffff",
};
const bytes = Buffer.from("synthetic bytes rejected before decoder invocation");
const source: ArtworkPaletteBackfillRow = {
  assetId: "20000000-0000-4000-8000-000000000001",
  objectKey: "/artwork.png",
  storageProvider: "static",
  checksumSha256: createHash("sha256").update(bytes).digest("hex"),
  mimeType: "image/png",
  byteSize: bytes.byteLength,
  algorithmVersion: 1,
  current: false,
  hasOverride: false,
  reviewedSlugs: [],
};
const jobId = "30000000-0000-4000-8000-000000000001";
const leaseToken = "40000000-0000-4000-8000-000000000001";

function processor() {
  const dependencies = {
    claimExact: vi.fn().mockResolvedValue(leaseToken),
    decode: vi.fn().mockResolvedValue(colors),
    palettes: {
      persistReady: vi.fn().mockResolvedValue(true),
      persistFailed: vi.fn().mockResolvedValue(true),
    },
    outbox: {
      acknowledge: vi.fn().mockResolvedValue(true),
      fail: vi.fn().mockResolvedValue(true),
      retry: vi.fn().mockResolvedValue(true),
    },
  };
  return { ...dependencies, run: createStaticArtworkPaletteProcessor(dependencies) };
}

describe("static artwork source confinement", () => {
  let temporaryDirectory: string;
  let publicDirectory: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "sunsyn-static-palette-"));
    publicDirectory = path.join(temporaryDirectory, "public");
    await mkdir(publicDirectory);
    await writeFile(path.join(publicDirectory, "artwork.png"), bytes);
    await writeFile(path.join(temporaryDirectory, "outside.png"), bytes);
    localDecoder.invoke.mockResolvedValue({
      stdout: JSON.stringify({
        version: 1,
        colors,
        checksumSha256: source.checksumSha256,
        byteSize: source.byteSize,
        mimeType: source.mimeType,
        width: 48,
        height: 48,
      }),
      stderr: "",
    });
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it.each(["artwork.png", "/artwork.png"])(
    "accepts confined catalogue key %s",
    async (objectKey) => {
      expect(await decodeStaticArtwork({ ...source, objectKey }, publicDirectory)).toEqual(colors);
      expect(localDecoder.invoke).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining([path.join(publicDirectory, "artwork.png"), source.mimeType]),
        expect.objectContaining({ timeout: 45_000, maxBuffer: 16_384 }),
      );
    },
  );

  it("rejects parent traversal before reading outside public", async () => {
    await expect(
      decodeStaticArtwork({ ...source, objectKey: "/../outside.png" }, publicDirectory),
    ).rejects.toThrow("INVALID_SOURCE");
    await expect(
      decodeStaticArtwork({ ...source, objectKey: "../outside.png" }, publicDirectory),
    ).rejects.toThrow("INVALID_SOURCE");
    expect(localDecoder.invoke).not.toHaveBeenCalled();
  });

  it.each(["artwork\\image.png", "artwork\0.png"])(
    "rejects noncanonical key %j",
    async (objectKey) => {
      await expect(decodeStaticArtwork({ ...source, objectKey }, publicDirectory)).rejects.toThrow(
        "INVALID_SOURCE",
      );
      expect(localDecoder.invoke).not.toHaveBeenCalled();
    },
  );

  it("does not interpret an absolute filesystem path as an escape from public", async () => {
    // The outside file exists and matches declared provenance. Accepting this key
    // as a filesystem path would reach the decoder instead of rejecting it.
    await expect(
      decodeStaticArtwork(
        {
          ...source,
          objectKey: path.join(temporaryDirectory, "outside.png"),
        },
        publicDirectory,
      ),
    ).rejects.toThrow();
    expect(localDecoder.invoke).not.toHaveBeenCalled();
  });

  it("rejects symlinks whose real target is outside public", async () => {
    await symlink(
      path.join(temporaryDirectory, "outside.png"),
      path.join(publicDirectory, "link.png"),
    );
    await expect(
      decodeStaticArtwork({ ...source, objectKey: "/link.png" }, publicDirectory),
    ).rejects.toThrow("INVALID_SOURCE");
    expect(localDecoder.invoke).not.toHaveBeenCalled();
  });

  it("rejects size and checksum mismatches before invoking the local decoder", async () => {
    await expect(
      decodeStaticArtwork({ ...source, byteSize: bytes.byteLength + 1 }, publicDirectory),
    ).rejects.toThrow("SOURCE_MISMATCH");
    await expect(
      decodeStaticArtwork({ ...source, checksumSha256: "0".repeat(64) }, publicDirectory),
    ).rejects.toThrow("SOURCE_MISMATCH");
    expect(localDecoder.invoke).not.toHaveBeenCalled();
  });

  it("rejects unsupported legacy SVG explicitly", async () => {
    await expect(
      decodeStaticArtwork({ ...source, mimeType: "image/svg+xml" }, publicDirectory),
    ).rejects.toThrow("UNSUPPORTED_SOURCE");
    expect(localDecoder.invoke).not.toHaveBeenCalled();
  });
});

describe("static backfill exact-job persistence", () => {
  it("claims the exact scanned source and reports processed only after acknowledgment", async () => {
    const instance = processor();
    expect(await instance.run(source, jobId)).toBe("processed");
    const expectedSource = {
      assetId: source.assetId,
      objectKey: source.objectKey,
      storageProvider: source.storageProvider,
      checksumSha256: source.checksumSha256,
      mimeType: source.mimeType,
      byteSize: source.byteSize,
      algorithmVersion: source.algorithmVersion,
    };
    expect(instance.claimExact).toHaveBeenCalledWith(jobId, expectedSource);
    expect(instance.palettes.persistReady).toHaveBeenCalledWith({
      jobId,
      leaseToken,
      source: expectedSource,
      colors,
    });
    expect(instance.outbox.acknowledge).toHaveBeenCalledWith(jobId, leaseToken);
    expect(instance.palettes.persistFailed).not.toHaveBeenCalled();
  });

  it("leaves a replacement job untouched when its exact-source claim is rejected", async () => {
    const instance = processor();
    instance.claimExact.mockResolvedValue(null);
    expect(await instance.run(source, jobId)).toBe("queued");
    expect(instance.decode).not.toHaveBeenCalled();
    expect(instance.palettes.persistReady).not.toHaveBeenCalled();
    expect(instance.palettes.persistFailed).not.toHaveBeenCalled();
    expect(instance.outbox.acknowledge).not.toHaveBeenCalled();
    expect(instance.outbox.fail).not.toHaveBeenCalled();
    expect(instance.outbox.retry).not.toHaveBeenCalled();
  });

  it("treats rejected source or lease CAS as queued without recording a false failure", async () => {
    const instance = processor();
    instance.palettes.persistReady.mockResolvedValue(false);
    expect(await instance.run(source, jobId)).toBe("queued");
    expect(instance.outbox.acknowledge).toHaveBeenCalledWith(jobId, leaseToken);
    expect(instance.palettes.persistFailed).not.toHaveBeenCalled();
    expect(instance.outbox.fail).not.toHaveBeenCalled();
  });

  it.each(["rejected", "lost"] as const)(
    "preserves a committed palette when acknowledgment is %s",
    async (failure) => {
      const instance = processor();
      if (failure === "rejected") instance.outbox.acknowledge.mockResolvedValue(false);
      else instance.outbox.acknowledge.mockRejectedValue(new Error("connection lost after commit"));
      await expect(instance.run(source, jobId)).rejects.toThrow("COMPLETION_UNCERTAIN");
      expect(instance.palettes.persistReady).toHaveBeenCalledOnce();
      expect(instance.palettes.persistFailed).not.toHaveBeenCalled();
      expect(instance.outbox.fail).not.toHaveBeenCalled();
      expect(instance.outbox.retry).toHaveBeenCalledWith(
        jobId,
        leaseToken,
        "COMPLETION_UNCERTAIN",
        60,
      );
    },
  );

  it("preserves a possible commit when persistence loses its response", async () => {
    const instance = processor();
    instance.palettes.persistReady.mockRejectedValue(new Error("commit response lost"));
    await expect(instance.run(source, jobId)).rejects.toThrow("COMPLETION_UNCERTAIN");
    expect(instance.palettes.persistFailed).not.toHaveBeenCalled();
    expect(instance.outbox.fail).not.toHaveBeenCalled();
    expect(instance.outbox.retry).toHaveBeenCalledWith(
      jobId,
      leaseToken,
      "COMPLETION_UNCERTAIN",
      60,
    );
  });

  it("records an explicit unsupported-source failure without attempting ready persistence", async () => {
    const instance = processor();
    instance.decode.mockRejectedValue(new Error("UNSUPPORTED_SOURCE"));
    await expect(instance.run({ ...source, mimeType: "image/svg+xml" }, jobId)).rejects.toThrow(
      "UNSUPPORTED_SOURCE",
    );
    expect(instance.palettes.persistReady).not.toHaveBeenCalled();
    expect(instance.palettes.persistFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId,
        leaseToken,
        errorCode: "UNSUPPORTED_SOURCE",
      }),
    );
    expect(instance.outbox.fail).toHaveBeenCalledWith(jobId, leaseToken, "UNSUPPORTED_SOURCE");
  });
});
