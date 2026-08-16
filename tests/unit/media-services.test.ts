import { describe, expect, it } from "vitest";

import { createMediaDeliveryUrl, verifyMediaSignature } from "../../app/services/media-signing";
import { parseUploadDeclaration, validateUploadDeclaration } from "../../app/services/media.server";
import { serializeJsonLd } from "../../app/utils/json-ld";

const checksum = "a".repeat(64);

describe("managed media declarations", () => {
  it("accepts complete artwork and audio declarations in separate scopes", () => {
    expect(
      validateUploadDeclaration({
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: checksum,
        byteSize: 1024,
        width: 1200,
        height: 1200,
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateUploadDeclaration({
        kind: "audio",
        scope: "private_master",
        mimeType: "audio/flac",
        checksumSha256: checksum,
        byteSize: 4096,
        targetEntityId: crypto.randomUUID(),
        durationMs: 180_000,
        codec: "flac",
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects unsafe types, sizes, checksums, and missing metadata", () => {
    expect(
      parseUploadDeclaration({
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/svg+xml",
        checksumSha256: checksum,
        byteSize: 1024,
        width: 1200,
        height: 1200,
      }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      validateUploadDeclaration({
        kind: "audio",
        scope: "private_master",
        mimeType: "audio/flac",
        checksumSha256: "invalid",
        byteSize: 501 * 1024 * 1024,
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("signed media delivery", () => {
  it("accepts a short-lived signed URL and rejects tampering or expiry", async () => {
    const issuedAt = new Date("2026-08-16T08:00:00Z");
    const signed = await createMediaDeliveryUrl(
      "https://radio.example",
      "audio",
      "asset-7",
      "test-signing-secret",
      issuedAt,
    );

    await expect(
      verifyMediaSignature(new URL(signed), "test-signing-secret", issuedAt),
    ).resolves.toBe(true);
    const tampered = new URL(signed);
    tampered.pathname = "/media/audio/another-asset";
    await expect(verifyMediaSignature(tampered, "test-signing-secret", issuedAt)).resolves.toBe(
      false,
    );
    await expect(
      verifyMediaSignature(
        new URL(signed),
        "test-signing-secret",
        new Date("2026-08-16T08:05:01Z"),
      ),
    ).resolves.toBe(false);
  });

  describe("structured data serialization", () => {
    it("does not allow curator text to close the JSON-LD script element", () => {
      const serialized = serializeJsonLd({
        name: '</script><script>alert("xss")</script>',
      });

      expect(serialized).not.toContain("</script>");
      expect(JSON.parse(serialized)).toEqual({
        name: '</script><script>alert("xss")</script>',
      });
    });
  });
});
