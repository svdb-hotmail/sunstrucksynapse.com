import { describe, expect, it, vi } from "vitest";

import { cloudflareContext } from "../../app/config/cloudflare-context.server";
import { loader as mediaLoader } from "../../app/routes/media";
import {
  createMediaDeliveryUrl,
  getR2PlaybackUrlEndpoint,
  isR2MediaUrl,
  resolveFreshPlaybackUrl,
  verifyMediaSignature,
} from "../../app/services/media-signing";
import { parseUploadDeclaration, validateUploadDeclaration } from "../../app/services/media.server";
import { serializeJsonLd } from "../../app/utils/json-ld";
import type { LoaderFunctionArgs } from "react-router";

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

describe("signed media delivery and fresh playback resolution", () => {
  const secret = "test-signing-secret";

  it("accepts a short-lived signed URL and rejects tampering or expiry", async () => {
    const issuedAt = new Date("2026-08-16T08:00:00Z");
    const signed = await createMediaDeliveryUrl(
      "https://radio.example",
      "audio",
      "asset-7",
      secret,
      issuedAt,
    );

    await expect(verifyMediaSignature(new URL(signed), secret, issuedAt)).resolves.toBe(true);
    const tampered = new URL(signed);
    tampered.pathname = "/media/audio/another-asset";
    await expect(verifyMediaSignature(tampered, secret, issuedAt)).resolves.toBe(false);
    await expect(
      verifyMediaSignature(new URL(signed), secret, new Date("2026-08-16T08:05:01Z")),
    ).resolves.toBe(false);
  });

  it("identifies R2 vs static Phase 1 asset paths accurately", () => {
    expect(isR2MediaUrl("/media/audio/asset-123")).toBe(true);
    expect(isR2MediaUrl("/media/artwork/asset-456")).toBe(true);
    expect(isR2MediaUrl("/media/audio/asset-123?expires=300&signature=abc")).toBe(true);
    expect(isR2MediaUrl("/assets/audio/Sunstruck Synapse.mp3")).toBe(false);
    expect(isR2MediaUrl("/assets/video/AI_pop-slop.mp4")).toBe(false);
    expect(isR2MediaUrl("/assets/thumbs/thumb-01.svg")).toBe(false);

    expect(getR2PlaybackUrlEndpoint("/media/audio/asset-123")).toBe(
      "/media/audio/asset-123?playback=true",
    );
    expect(getR2PlaybackUrlEndpoint("/media/audio/asset-123?expires=100&signature=xyz")).toBe(
      "/media/audio/asset-123?playback=true",
    );
    expect(getR2PlaybackUrlEndpoint("/assets/audio/song.mp3")).toBeNull();
  });

  it("preserves static Phase 1 assets without triggering network fetch", async () => {
    const staticAudio = "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3";
    const staticVideo = "/assets/video/final-movie_00007_.mp4";
    const mockFetcher = vi.fn();

    await expect(
      resolveFreshPlaybackUrl(staticAudio, mockFetcher as unknown as typeof fetch),
    ).resolves.toBe(staticAudio);
    await expect(
      resolveFreshPlaybackUrl(staticVideo, mockFetcher as unknown as typeof fetch),
    ).resolves.toBe(staticVideo);
    expect(mockFetcher).not.toHaveBeenCalled();
  });

  it("proves delayed queued playback beyond five minutes gets a valid fresh URL", async () => {
    const t0 = new Date("2026-08-16T08:00:00Z");
    const assetId = "30000000-0000-4000-8000-000000000102";

    // At t0, an expiring URL would be valid only until 08:05:00
    const urlAtT0 = await createMediaDeliveryUrl("", "audio", assetId, secret, t0);
    await expect(
      verifyMediaSignature(new URL(urlAtT0, "https://example.com"), secret, t0),
    ).resolves.toBe(true);

    // Clock advances beyond 5 minutes to t = 6 minutes (08:06:00)
    const tDelayed = new Date("2026-08-16T08:06:00Z");

    // The old URL from t0 is now expired
    await expect(
      verifyMediaSignature(new URL(urlAtT0, "https://example.com"), secret, tDelayed),
    ).resolves.toBe(false);

    // When the queued track is played at tDelayed, it mints a fresh signed URL
    const freshUrlAtTDelayed = await createMediaDeliveryUrl("", "audio", assetId, secret, tDelayed);

    const mockFetcher = vi.fn().mockImplementation(async (url: string) => {
      expect(url).toBe(`/media/audio/${assetId}?playback=true`);
      return new Response(JSON.stringify({ url: freshUrlAtTDelayed }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const canonicalItemMediaSrc = `/media/audio/${assetId}`;
    const resolvedUrl = await resolveFreshPlaybackUrl(
      canonicalItemMediaSrc,
      mockFetcher as unknown as typeof fetch,
    );

    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(resolvedUrl).toBe(freshUrlAtTDelayed);

    // The fresh URL is valid at the advanced time tDelayed
    await expect(
      verifyMediaSignature(new URL(resolvedUrl, "https://example.com"), secret, tDelayed),
    ).resolves.toBe(true);

    // And remains valid for the full 5-minute duration from tDelayed (until 08:11:00)
    await expect(
      verifyMediaSignature(
        new URL(resolvedUrl, "https://example.com"),
        secret,
        new Date("2026-08-16T08:10:59Z"),
      ),
    ).resolves.toBe(true);
  });

  it("obtains a fresh URL on retry after expired or 403 playback failure", async () => {
    const t0 = new Date("2026-08-16T08:00:00Z");
    const tRetry = new Date("2026-08-16T08:07:30Z"); // 7.5 minutes later
    const assetId = "30000000-0000-4000-8000-000000000104";

    const expiredUrl = await createMediaDeliveryUrl("", "audio", assetId, secret, t0);
    // Verified that previous URL is now 403 / expired at retry time
    await expect(
      verifyMediaSignature(new URL(expiredUrl, "https://example.com"), secret, tRetry),
    ).resolves.toBe(false);

    // On retry, the player requests a fresh playback URL
    const freshlyMintedUrl = await createMediaDeliveryUrl("", "audio", assetId, secret, tRetry);
    const mockFetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: freshlyMintedUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Even if passed the expired URL or canonical URL, it queries the endpoint and returns the fresh URL
    const retryResolvedUrl = await resolveFreshPlaybackUrl(
      expiredUrl,
      mockFetcher as unknown as typeof fetch,
    );

    expect(mockFetcher).toHaveBeenCalledWith(`/media/audio/${assetId}?playback=true`, {
      headers: { Accept: "application/json" },
    });
    expect(retryResolvedUrl).toBe(freshlyMintedUrl);

    // The newly minted retry URL is verified valid at tRetry
    await expect(
      verifyMediaSignature(new URL(retryResolvedUrl, "https://example.com"), secret, tRetry),
    ).resolves.toBe(true);
  });

  describe("media route delivery and redirect behavior", () => {
    const assetId = "asset-route-test-1";
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: assetId,
                  objectKey: "publishable/audio/route-test.mp3",
                  mimeType: "audio/mpeg",
                },
              ]),
          }),
        }),
      }),
    };
    const mockBucket = {
      get: vi.fn().mockResolvedValue({
        body: new ReadableStream(),
        size: 2048,
        httpEtag: '"etag-test"',
        writeHttpMetadata: (headers: Headers) => {
          headers.set("content-type", "audio/mpeg");
        },
      }),
    };
    const mockContext = {
      get(key: unknown) {
        if (key === cloudflareContext) {
          return {
            db: mockDb as unknown as LoaderFunctionArgs["context"],
            env: {
              MEDIA_DELIVERY_SIGNING_SECRET: secret,
              MEDIA_BUCKET: mockBucket,
            },
          };
        }
        return undefined;
      },
    } as unknown as LoaderFunctionArgs["context"];

    it("redirects unsigned canonical media requests (307) to a freshly signed URL", async () => {
      const request = new Request(`https://example.com/media/audio/${assetId}`);
      const response = await mediaLoader({
        request,
        params: { kind: "audio", assetId },
        context: mockContext,
      });

      expect(response.status).toBe(307);
      const location = response.headers.get("Location");
      expect(location).toContain(`/media/audio/${assetId}?expires=`);
      expect(location).toContain("&signature=");

      // The redirect target is signed and valid
      await expect(
        verifyMediaSignature(new URL(location!), secret),
      ).resolves.toBe(true);
    });

    it("returns JSON when unsigned request specifies ?playback=true or Accept: application/json", async () => {
      const request = new Request(`https://example.com/media/audio/${assetId}?playback=true`, {
        headers: { Accept: "application/json" },
      });
      const response = await mediaLoader({
        request,
        params: { kind: "audio", assetId },
        context: mockContext,
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { url: string };
      expect(data.url).toContain(`/media/audio/${assetId}?expires=`);
      await expect(
        verifyMediaSignature(new URL(data.url, "https://example.com"), secret),
      ).resolves.toBe(true);
    });

    it("streams media directly when a valid signed URL is requested", async () => {
      const signedUrl = await createMediaDeliveryUrl("https://example.com", "audio", assetId, secret);
      const request = new Request(signedUrl);
      const response = await mediaLoader({
        request,
        params: { kind: "audio", assetId },
        context: mockContext,
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("audio/mpeg");
      expect(mockBucket.get).toHaveBeenCalled();
    });

    it("returns 403 for an expired signed URL", async () => {
      const expiredUrl = await createMediaDeliveryUrl(
        "https://example.com",
        "audio",
        assetId,
        secret,
        new Date("2020-01-01T00:00:00Z"),
      );
      const request = new Request(expiredUrl);
      const response = await mediaLoader({
        request,
        params: { kind: "audio", assetId },
        context: mockContext,
      });

      expect(response.status).toBe(403);
    });
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
