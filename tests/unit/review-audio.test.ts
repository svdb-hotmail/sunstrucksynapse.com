import { describe, expect, it, vi } from "vitest";

import type { MediaBucket } from "../../app/config/env.server";
import type {
  ReviewAudioRecord,
  ReviewAudioUploadSession,
} from "../../app/repositories/curation-workflow.server";
import {
  ReviewAudioService,
  parseReviewAudioDeclaration,
  type ReviewAudioEnv,
  type ReviewAudioRepository,
} from "../../app/services/review-audio.server";
import { IncrementalSha256 } from "../../app/utils/sha256";

const declaration = {
  filename: "signal.flac",
  mimeType: "audio/flac",
  checksumSha256: "a".repeat(64),
  byteSize: 4096,
  durationMs: 180000,
  codec: "flac",
};

class MemoryMediaBucket implements MediaBucket {
  readonly objects = new Map<string, Uint8Array>();
  readonly deleted: string[] = [];
  rejectPut = false;
  omitGet = false;
  omitSealedObject = false;
  rejectHead = false;
  rejectGet = false;
  rejectDelete = false;

  async put(
    key: string,
    value: ReadableStream<Uint8Array>,
    _options: {
      httpMetadata: { contentType: string };
      customMetadata: Record<string, string>;
      sha256: string;
    },
  ): Promise<{ size: number }> {
    if (this.rejectPut) throw new Error("put failed");
    const reader = value.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      chunks.push(chunk);
      size += chunk.byteLength;
    }
    if (!this.omitSealedObject) {
      const stored = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        stored.set(chunk, offset);
        offset += chunk.byteLength;
      }
      this.objects.set(key, stored);
    }
    return { size };
  }

  async head(key: string) {
    if (this.rejectHead) throw new Error("head failed");
    const stored = this.objects.get(key);
    return stored ? { size: stored.byteLength } : null;
  }

  async get(key: string, _options: { range: Headers }) {
    if (this.rejectGet) throw new Error("get failed");
    if (this.omitGet) return null;
    const stored = this.objects.get(key);
    if (!stored) return null;
    return {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(stored);
          controller.close();
        },
      }),
      size: stored.byteLength,
      httpEtag: "memory-etag",
      writeHttpMetadata() {},
    };
  }

  async delete(key: string): Promise<void> {
    this.deleted.push(key);
    if (this.rejectDelete) throw new Error("delete failed");
    this.objects.delete(key);
  }
}

const bytes = new TextEncoder().encode("signal");
const hasher = new IncrementalSha256();
hasher.update(bytes);
const checksumSha256 = hasher.digestHex();
const session: ReviewAudioUploadSession = {
  id: "10000000-0000-4000-8000-000000000001",
  submissionId: "20000000-0000-4000-8000-000000000001",
  stagingObjectKey: "private/review-audio/staging/10000000-0000-4000-8000-000000000001",
  filename: "signal.flac",
  mimeType: "audio/flac",
  checksumSha256,
  byteSize: bytes.byteLength,
  durationMs: 180000,
  codec: "flac",
  status: "finalizing",
  leaseToken: "30000000-0000-4000-8000-000000000001",
  leaseExpiresAt: new Date("2026-09-07T12:02:00.000Z"),
  expiresAt: new Date("2026-09-07T12:15:00.000Z"),
};
const audio: ReviewAudioRecord = {
  ...session,
  id: "40000000-0000-4000-8000-000000000001",
  version: 1,
  objectKey: "private/review-audio/final/audio",
  finalizedAt: new Date("2026-09-07T12:00:00.000Z"),
};

function createRepository(overrides: Partial<ReviewAudioRepository> = {}): ReviewAudioRepository {
  return {
    createAudioUploadSession: vi.fn(async () => session),
    claimAudioFinalization: vi.fn(async () => session),
    renewAudioFinalizationLease: vi.fn(async () => true),
    releaseAudioFinalization: vi.fn(async () => {}),
    completeAudioFinalization: vi.fn(async () => audio),
    ...overrides,
  };
}

function createFinalization(bucket = new MemoryMediaBucket(), repository = createRepository()) {
  bucket.objects.set(session.stagingObjectKey, bytes);
  const env = { MEDIA_BUCKET: bucket } satisfies ReviewAudioEnv;
  const service = new ReviewAudioService(
    repository,
    env,
    () => new Date("2026-09-07T12:00:00.000Z"),
  );
  return { bucket, repository, service };
}

describe("review audio declarations", () => {
  it("accepts a bounded supported listening copy", () => {
    expect(parseReviewAudioDeclaration(declaration)).toEqual({ ok: true, value: declaration });
  });

  it.each(["audio/x-wav", "audio/wave", "audio/vnd.wave"])(
    "normalizes the browser WAV MIME type %s",
    (mimeType) => {
      expect(
        parseReviewAudioDeclaration({ ...declaration, filename: "signal.wav", mimeType }),
      ).toEqual({
        ok: true,
        value: { ...declaration, filename: "signal.wav", mimeType: "audio/wav" },
      });
    },
  );

  it("rejects unsupported and oversized inputs before creating a staging key", () => {
    expect(parseReviewAudioDeclaration({ ...declaration, mimeType: "video/mp4" })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(
      parseReviewAudioDeclaration({ ...declaration, byteSize: 500 * 1024 * 1024 + 1 }),
    ).toMatchObject({
      ok: false,
      status: 413,
    });
  });

  it("signs content type and upload metadata into the short-lived R2 PUT", async () => {
    const repository = createRepository();
    const env = {
      MEDIA_BUCKET: new MemoryMediaBucket(),
      R2_ACCOUNT_ID: "account",
      R2_ACCESS_KEY_ID: "access-key",
      R2_SECRET_ACCESS_KEY: "secret-key",
      R2_BUCKET_NAME: "private-bucket",
    } satisfies ReviewAudioEnv;
    const result = await new ReviewAudioService(
      repository,
      env,
      () => new Date("2026-09-07T12:00:00.000Z"),
    ).createUpload("b".repeat(64), declaration);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.value.uploadUrl);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signedHeaders).toContain("content-type");
    expect(signedHeaders).toContain("x-amz-meta-checksum-sha256");
    expect(signedHeaders).toContain("x-amz-meta-upload-session-id");
  });
});

describe("review audio finalization", () => {
  it("seals verified bytes under a lease-fenced key and removes staging", async () => {
    const { bucket, repository, service } = createFinalization();

    const result = await service.finalize("token", session.id);

    expect(result).toEqual({ ok: true, value: audio });
    expect(repository.renewAudioFinalizationLease).toHaveBeenCalledOnce();
    expect(repository.completeAudioFinalization).toHaveBeenCalledOnce();
    expect(bucket.objects.has(session.stagingObjectKey)).toBe(false);
    expect([...bucket.objects.keys()][0]).toContain(`${session.id}-${session.leaseToken}`);
  });

  it.each([
    ["missing bytes", (bucket: MemoryMediaBucket) => bucket.objects.clear(), "OBJECT_INCOMPLETE"],
    ["missing object", (bucket: MemoryMediaBucket) => (bucket.omitGet = true), "OBJECT_MISSING"],
    ["head outage", (bucket: MemoryMediaBucket) => (bucket.rejectHead = true), "R2_HEAD_FAILED"],
    ["get outage", (bucket: MemoryMediaBucket) => (bucket.rejectGet = true), "R2_GET_FAILED"],
  ])("releases the claim when staging has %s", async (_label, configure, code) => {
    const { bucket, repository, service } = createFinalization();
    configure(bucket);

    await expect(service.finalize("token", session.id)).resolves.toMatchObject({ ok: false });
    expect(repository.releaseAudioFinalization).toHaveBeenCalledWith(
      session.id,
      session.leaseToken,
      code,
      expect.any(Date),
    );
  });

  it("removes the fenced object when streaming verification fails", async () => {
    const invalidSession = { ...session, checksumSha256: "f".repeat(64) };
    const repository = createRepository({
      claimAudioFinalization: vi.fn(async () => invalidSession),
    });
    const { bucket, service } = createFinalization(new MemoryMediaBucket(), repository);

    await expect(service.finalize("token", session.id)).resolves.toMatchObject({ ok: false });
    expect(bucket.deleted.some((key) => key.startsWith("private/review-audio/final/"))).toBe(true);
    expect(repository.releaseAudioFinalization).toHaveBeenCalled();
  });

  it("removes the fenced object when the sealed copy is missing", async () => {
    const bucket = new MemoryMediaBucket();
    bucket.omitSealedObject = true;
    const { repository, service } = createFinalization(bucket);

    await expect(service.finalize("token", session.id)).resolves.toMatchObject({ ok: false });
    expect(repository.releaseAudioFinalization).toHaveBeenCalledWith(
      session.id,
      session.leaseToken,
      "SEALING_FAILED",
      expect.any(Date),
    );
  });

  it("removes the fenced object when the lease is lost", async () => {
    const repository = createRepository({
      renewAudioFinalizationLease: vi.fn(async () => false),
    });
    const { bucket, service } = createFinalization(new MemoryMediaBucket(), repository);

    await expect(service.finalize("token", session.id)).resolves.toMatchObject({ ok: false });
    expect(bucket.deleted.some((key) => key.startsWith("private/review-audio/final/"))).toBe(true);
    expect(repository.completeAudioFinalization).not.toHaveBeenCalled();
  });

  it("removes the fenced object when database completion conflicts", async () => {
    const repository = createRepository({
      completeAudioFinalization: vi.fn(async () => null),
    });
    const { bucket, service } = createFinalization(new MemoryMediaBucket(), repository);

    await expect(service.finalize("token", session.id)).resolves.toMatchObject({ ok: false });
    expect(bucket.deleted.some((key) => key.startsWith("private/review-audio/final/"))).toBe(true);
  });

  it("keeps a completed finalization successful when immediate staging cleanup fails", async () => {
    const bucket = new MemoryMediaBucket();
    const { service } = createFinalization(bucket);
    bucket.rejectDelete = true;

    await expect(service.finalize("token", session.id)).resolves.toEqual({
      ok: true,
      value: audio,
    });
  });
});
