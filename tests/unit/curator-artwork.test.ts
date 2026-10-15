import { createHash } from "node:crypto";
import { expect, it, vi, afterEach } from "vitest";
import { storeCuratorArtwork } from "../../app/services/curator-artwork.server";
import { prepareCuratorCover } from "../../app/features/curator-workspace/SubmissionEditor";
import { validateEditorialFields } from "../../app/types/submission-edit";
import type { WorkerEnv } from "../../app/config/env.server";

function png(width: number, height = width) {
  const b = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").copy(b);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
afterEach(() => vi.unstubAllGlobals());
it("validates actual image dimensions and stores a private cover with native SHA verification", async () => {
  const bytes = png(1400);
  const put = vi.fn().mockResolvedValue({ size: bytes.length });
  const env = { MEDIA_BUCKET: { put } } as unknown as WorkerEnv;
  const cover = await storeCuratorArtwork(
    new File([bytes], "cover.png", { type: "image/png" }),
    env,
  );
  expect(cover).toMatchObject({
    width: 1400,
    height: 1400,
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
  });
  expect(cover.objectKey).toMatch(/^private\/curator-artwork\//);
  expect(put).toHaveBeenCalledWith(
    cover.objectKey,
    expect.anything(),
    expect.objectContaining({ sha256: cover.checksumSha256 }),
  );
  for (const bytes of [png(1399), png(1400, 1401), png(10001), Buffer.from("<svg/>")]) {
    await expect(
      storeCuratorArtwork(new File([bytes], "fake.png", { type: "image/png" }), env),
    ).rejects.toThrow();
  }
  expect(put).toHaveBeenCalledTimes(1);
});
it("resizes a small square cover without cropping and preserves a large cover unchanged", async () => {
  const drawImage = vi.fn();
  const close = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage, imageSmoothingQuality: "" }),
    toBlob: (fn: (b: Blob) => void) => fn(new Blob([png(1400)], { type: "image/png" })),
  };
  const createImageBitmap = vi.fn().mockResolvedValue({ width: 1254, height: 1254, close });
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  vi.stubGlobal("document", { createElement: () => canvas });
  const file = new File([png(1254)], "small.png", { type: "image/png" });
  const resized = await prepareCuratorCover(file);
  expect(canvas.width).toBe(1400);
  expect(canvas.height).toBe(1400);
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1400, 1400);
  expect(resized.name).toBe("small-1400.png");
  expect(close).toHaveBeenCalledOnce();
  createImageBitmap.mockResolvedValue({ width: 3000, height: 3000, close });
  expect(await prepareCuratorCover(file)).toBe(file);
  createImageBitmap.mockResolvedValue({ width: 1254, height: 1255, close });
  await expect(prepareCuratorCover(file)).rejects.toThrow("square");
});
it("supports saving incomplete metadata while rejecting unknown selections", () => {
  const fields = {
    title: "Track",
    releaseTitle: "Release",
    summary: "",
    genres: [],
    moods: [],
    processTags: [],
  };
  expect(validateEditorialFields(fields)).toEqual(fields);
  expect(() => validateEditorialFields({ ...fields, genres: ["Invented genre"] })).toThrow();
  expect(() => validateEditorialFields({ ...fields, title: "" })).toThrow();
});
