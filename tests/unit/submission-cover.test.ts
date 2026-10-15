import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateCover, SubmissionCoverService } from "../../app/services/submission-cover.server";
import type { WorkerEnv } from "../../app/config/env.server";
const repository = vi.hoisted(() => ({
  claimCover: vi.fn(),
  completeCover: vi.fn(),
  releaseCover: vi.fn(),
}));
vi.mock("../../app/repositories/release-intake.server", () => ({
  createReleaseIntakeRepository: () => repository,
}));
const id = "10000000-0000-4000-8000-000000000001";
function png(width = 1400, height = width) {
  const bytes = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").copy(bytes);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}
const bytes = png();
const declaration = {
  filename: "cover.png",
  mimeType: "image/png",
  checksumSha256: createHash("sha256").update(bytes).digest("hex"),
  byteSize: bytes.length,
  width: 1400,
  height: 1400,
  rightsConfirmed: true,
};
function runtime(header = bytes, sourceSize = bytes.length) {
  const bucket = {
    get: vi
      .fn()
      .mockImplementation(async (_key, options) => ({
        size: options.range.has("range") ? header.length : sourceSize,
        body: new Blob([header]).stream(),
      })),
    put: vi.fn().mockResolvedValue({ size: bytes.length }),
    head: vi.fn().mockResolvedValue({ size: bytes.length }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  return {
    bucket,
    service: new SubmissionCoverService(
      {} as never,
      { MEDIA_BUCKET: bucket } as unknown as WorkerEnv,
    ),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  repository.claimCover.mockResolvedValue({
    ...declaration,
    id,
    submissionId: id,
    stagingObjectKey: `private/submission-covers/staging/${id}`,
  });
  repository.completeCover.mockResolvedValue({ id });
  repository.releaseCover.mockResolvedValue(undefined);
});
describe("artist cover sealing", () => {
  it("requires explicit artwork permission and bounded, square dimensions", () => {
    expect(validateCover(declaration)).toEqual(declaration);
    for (const patch of [
      { rightsConfirmed: false },
      { width: 1399, height: 1399 },
      { height: 1401 },
      { width: 10001, height: 10001 },
      { byteSize: 20971521 },
      { mimeType: "image/svg+xml" },
    ])
      expect(() => validateCover({ ...declaration, ...patch })).toThrow();
  });
  it("seals privately under a lease and asks native R2 to verify the exact checksum", async () => {
    const { bucket, service } = runtime();
    expect(await service.finalize("invitation-hash", id)).toEqual({ coverId: id });
    const lease = repository.claimCover.mock.calls[0][2];
    expect(bucket.put).toHaveBeenCalledWith(
      `private/submission-covers/final/${id}/${lease}`,
      expect.anything(),
      expect.objectContaining({
        sha256: declaration.checksumSha256,
        httpMetadata: { contentType: "image/png" },
      }),
    );
    expect(repository.completeCover).toHaveBeenCalledWith(
      "invitation-hash",
      id,
      lease,
      `private/submission-covers/final/${id}/${lease}`,
    );
    expect(bucket.delete).toHaveBeenCalledWith(`private/submission-covers/staging/${id}`);
  });
  it.each(["dimensions", "size"])(
    "rejects mismatched actual %s before registering or copying an image",
    async (kind) => {
      const { bucket, service } = runtime(
        kind === "dimensions" ? png(1500) : bytes,
        kind === "size" ? 1000 : bytes.length,
      );
      await expect(service.finalize("invitation-hash", id)).rejects.toThrow();
      expect(bucket.put).not.toHaveBeenCalled();
      expect(repository.completeCover).not.toHaveBeenCalled();
      expect(repository.releaseCover).toHaveBeenCalledOnce();
    },
  );
  it("does not read storage for another invitation and never leaves a lost lease selected", async () => {
    repository.claimCover.mockResolvedValueOnce(null);
    const first = runtime();
    await expect(first.service.finalize("wrong-invitation", id)).rejects.toThrow();
    expect(first.bucket.get).not.toHaveBeenCalled();
    repository.completeCover.mockResolvedValueOnce(null);
    const next = runtime();
    await expect(next.service.finalize("invitation-hash", id)).rejects.toThrow(
      "submission changed",
    );
    expect(next.bucket.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^private\/submission-covers\/final\//),
    );
    expect(next.bucket.delete).not.toHaveBeenCalledWith(`private/submission-covers/staging/${id}`);
  });
});
