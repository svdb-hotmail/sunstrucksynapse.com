import { describe, expect, it } from "vitest";

import type { WorkerEnv } from "../../app/config/env.server";
import type { CurationWorkflowRepository } from "../../app/repositories/curation-workflow.server";
import {
  ReviewAudioService,
  parseReviewAudioDeclaration,
} from "../../app/services/review-audio.server";

const declaration = {
  filename: "signal.flac",
  mimeType: "audio/flac",
  checksumSha256: "a".repeat(64),
  byteSize: 4096,
  durationMs: 180000,
  codec: "flac",
};

describe("review audio declarations", () => {
  it("accepts a bounded supported listening copy", () => {
    expect(parseReviewAudioDeclaration(declaration)).toEqual({ ok: true, value: declaration });
  });

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
    const repository = {
      async createAudioUploadSession() {
        return {
          ...declaration,
          originalFilename: declaration.filename,
          id: "10000000-0000-4000-8000-000000000001",
          submissionId: "20000000-0000-4000-8000-000000000001",
          stagingObjectKey: "private/review-audio/staging/10000000-0000-4000-8000-000000000001",
          status: "pending" as const,
          leaseToken: null,
          leaseExpiresAt: null,
          expiresAt: new Date("2026-09-07T12:15:00.000Z"),
        };
      },
    } as unknown as CurationWorkflowRepository;
    const env = {
      R2_ACCOUNT_ID: "account",
      R2_ACCESS_KEY_ID: "access-key",
      R2_SECRET_ACCESS_KEY: "secret-key",
      R2_BUCKET_NAME: "private-bucket",
    } as unknown as WorkerEnv;
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
