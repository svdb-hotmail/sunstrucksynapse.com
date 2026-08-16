import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { LoaderFunctionArgs } from "react-router";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { cloudflareContext } from "../../app/config/cloudflare-context.server";
import type { MediaBucket, WorkerEnv } from "../../app/config/env.server";
import {
  artistArtworkAssets,
  artists,
  artworkAssets,
  audioAssets,
  editorialCollections,
  releaseArtworkAssets,
  releases,
  trackArtworkAssets,
  tracks,
  uploadSessions,
} from "../../app/db/schema";
import * as schema from "../../app/db/schema";
import { createCatalogueRepository } from "../../app/repositories/catalogue.server";
import { loader as mediaLoader } from "../../app/routes/media";
import {
  createMediaDeliveryUrl,
  getR2PlaybackUrlEndpoint,
  isR2MediaUrl,
  resolveFreshPlaybackUrl,
  verifyMediaSignature,
} from "../../app/services/media-signing";
import {
  MediaService,
  parseUploadDeclaration,
  validateUploadDeclaration,
} from "../../app/services/media.server";
import { serializeJsonLd } from "../../app/utils/json-ld";
import { computeBlobSha256, IncrementalSha256 } from "../../app/utils/sha256";
import { seedDatabase } from "../../scripts/seed-data";

const checksum = "a".repeat(64);
const actor = { id: "curator-1", email: "curator@example.test" };

interface MockR2Item {
  body: Uint8Array;
  size: number;
  customMetadata?: Record<string, string>;
  httpMetadata?: Record<string, string>;
}

function createMockMediaBucket(): MediaBucket {
  const storage = new Map<string, MockR2Item>();

  const bucket: MediaBucket = {
    async put(key, value, options) {
      let bytes: Uint8Array;
      if (value && typeof value.getReader === "function") {
        const reader = value.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          if (chunk) {
            chunks.push(chunk);
            total += chunk.byteLength;
          }
        }
        bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
      } else {
        bytes = new Uint8Array(0);
      }

      const item: MockR2Item = {
        body: bytes,
        size: bytes.byteLength,
        customMetadata: options.customMetadata,
        httpMetadata: options.httpMetadata,
      };
      storage.set(key, item);

      return { size: bytes.byteLength };
    },
    async head(key) {
      const item = storage.get(key);
      if (!item) return null;
      return {
        size: item.size,
        customMetadata: item.customMetadata,
      };
    },
    async get(key) {
      const item = storage.get(key);
      if (!item) return null;
      return {
        size: item.size,
        httpEtag: '"mock-etag"',
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(item.body);
            controller.close();
          },
        }),
        range: undefined,
        writeHttpMetadata: (_headers: Headers) => {},
      };
    },
    async delete(key) {
      storage.delete(key);
    },
  };

  return bucket;
}

describe("managed media declarations", () => {
  it("accepts complete artwork and audio declarations in separate scopes and target entities", () => {
    expect(
      validateUploadDeclaration({
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: checksum,
        byteSize: 1024,
        width: 1200,
        height: 1200,
        targetEntityType: "artist",
        targetEntityId: crypto.randomUUID(),
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateUploadDeclaration({
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: checksum,
        byteSize: 1024,
        width: 1200,
        height: 1200,
        targetEntityType: "collection",
        targetEntityId: crypto.randomUUID(),
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateUploadDeclaration({
        kind: "audio",
        scope: "private_master",
        mimeType: "audio/flac",
        checksumSha256: checksum,
        byteSize: 4096,
        targetEntityType: "track",
        targetEntityId: crypto.randomUUID(),
        durationMs: 180_000,
        codec: "flac",
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects unsafe types, sizes, checksums, and missing metadata or targets", () => {
    expect(
      parseUploadDeclaration({
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/svg+xml",
        checksumSha256: checksum,
        byteSize: 1024,
        width: 1200,
        height: 1200,
        targetEntityType: "artist",
        targetEntityId: crypto.randomUUID(),
      }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      parseUploadDeclaration({
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: checksum,
        byteSize: 1024,
        width: 1200,
        height: 1200,
        targetEntityType: "artist",
        targetEntityId: "",
      }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      parseUploadDeclaration({
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: checksum,
        byteSize: 1024,
        width: 1200,
        height: 1200,
        targetEntityType: "unknown_entity",
        targetEntityId: crypto.randomUUID(),
      }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      parseUploadDeclaration({
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: checksum,
        byteSize: 1024,
        width: 1200,
        height: 1200,
        targetEntityId: crypto.randomUUID(),
      }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      validateUploadDeclaration({
        kind: "audio",
        scope: "private_master",
        mimeType: "audio/flac",
        checksumSha256: "invalid",
        byteSize: 501 * 1024 * 1024,
        targetEntityType: "track",
        targetEntityId: crypto.randomUUID(),
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseUploadDeclaration({
        kind: "audio",
        scope: "private_master",
        mimeType: "audio/flac",
        checksumSha256: checksum,
        byteSize: 1024,
        targetEntityType: "artist",
        targetEntityId: crypto.randomUUID(),
        durationMs: 1000,
        codec: "flac",
      }),
    ).toMatchObject({ ok: false, status: 400 });
  });
});

describe("incremental sha256 hashing", () => {
  it("matches standard test vectors across single and multi-chunk inputs", async () => {
    const emptyHasher = new IncrementalSha256();
    expect(emptyHasher.digestHex()).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );

    const abcHasher = new IncrementalSha256();
    abcHasher.update(new TextEncoder().encode("abc"));
    expect(abcHasher.digestHex()).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );

    const fox = "The quick brown fox jumps over the lazy dog";
    const foxHasher = new IncrementalSha256();
    const foxBytes = new TextEncoder().encode(fox);
    foxHasher.update(foxBytes.subarray(0, 10));
    foxHasher.update(foxBytes.subarray(10, 25));
    foxHasher.update(foxBytes.subarray(25));
    expect(foxHasher.digestHex()).toBe(
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    );

    const blob = new Blob([foxBytes]);
    await expect(computeBlobSha256(blob, 8)).resolves.toBe(
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    );
  });
});

describe("media service upload targeting, expiration, and streaming", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let mockBucket: MediaBucket;
  let env: WorkerEnv;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedDatabase(db);
    mockBucket = createMockMediaBucket();
    env = {
      DATABASE_URL: "postgres://localhost:5432/sunstruck_test",
      ACCESS_TEAM_DOMAIN: "https://auth.cloudflareaccess.com",
      ACCESS_AUD: "test-aud-secret",
      CURATOR_EMAILS: "curator@example.test",
      MEDIA_BUCKET: mockBucket,
      MEDIA_DELIVERY_SIGNING_SECRET: "test-signing-secret",
    };
  }, 30_000);

  afterAll(async () => {
    await client.close();
  });

  it("Gap #3: persists target artwork relationships for artist, release, track, and editorial collection", async () => {
    const [artist] = await db.select({ id: artists.id, slug: artists.slug }).from(artists).limit(1);
    const [release] = await db
      .select({ id: releases.id, slug: releases.slug })
      .from(releases)
      .limit(1);
    const [track] = await db
      .select({ id: tracks.id, slug: tracks.slug, releaseId: tracks.releaseId })
      .from(tracks)
      .limit(1);
    const [collection] = await db
      .select({ id: editorialCollections.id, slug: editorialCollections.slug })
      .from(editorialCollections)
      .limit(1);

    const targets = [
      { type: "artist" as const, id: artist.id },
      { type: "release" as const, id: release.id },
      { type: "track" as const, id: track.id },
      { type: "collection" as const, id: collection.id },
    ];

    const testContent = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const hasher = new IncrementalSha256();
    hasher.update(testContent);
    const validChecksum = hasher.digestHex();

    const service = new MediaService(db, env, () => new Date("2026-08-16T12:00:00Z"));

    const missingTarget = await service.createSession(
      {
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: validChecksum,
        byteSize: testContent.byteLength,
        width: 800,
        height: 800,
        targetEntityType: "artist",
        targetEntityId: crypto.randomUUID(),
      },
      actor,
    );
    expect(missingTarget).toEqual({
      ok: false,
      status: 404,
      message: "Target artist not found.",
    });

    for (const target of targets) {
      const created = await service.createSession(
        {
          kind: "artwork",
          scope: "publishable_derivative",
          mimeType: "image/webp",
          checksumSha256: validChecksum,
          byteSize: testContent.byteLength,
          width: 800,
          height: 800,
          targetEntityType: target.type,
          targetEntityId: target.id,
        },
        actor,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const request = new Request("https://example.test/upload", {
        method: "PUT",
        headers: { "content-type": "image/webp" },
        body: testContent,
      });
      const uploaded = await service.upload(created.value.id, request);
      expect(uploaded.ok).toBe(true);

      const completed = await service.complete(created.value.id);
      expect(completed.ok).toBe(true);
      if (!completed.ok) return;

      if (target.type === "artist") {
        const rows = await db
          .select()
          .from(artistArtworkAssets)
          .where(
            and(
              eq(artistArtworkAssets.artistId, target.id),
              eq(artistArtworkAssets.role, "avatar"),
            ),
          );
        expect(rows).toHaveLength(1);
        expect(rows[0].artworkAssetId).toBe(completed.value.assetId);
      } else if (target.type === "release") {
        const rows = await db
          .select()
          .from(releaseArtworkAssets)
          .where(
            and(
              eq(releaseArtworkAssets.releaseId, target.id),
              eq(releaseArtworkAssets.role, "primary"),
            ),
          );
        expect(rows).toHaveLength(1);
        expect(rows[0].artworkAssetId).toBe(completed.value.assetId);
      } else if (target.type === "track") {
        const rows = await db
          .select()
          .from(trackArtworkAssets)
          .where(
            and(eq(trackArtworkAssets.trackId, target.id), eq(trackArtworkAssets.role, "primary")),
          );
        expect(rows).toHaveLength(1);
        expect(rows[0].artworkAssetId).toBe(completed.value.assetId);
      } else if (target.type === "collection") {
        const [colRow] = await db
          .select()
          .from(editorialCollections)
          .where(eq(editorialCollections.id, target.id));
        expect(colRow.artworkAssetId).toBe(completed.value.assetId);
      }
    }

    const catalogueRepo = createCatalogueRepository(db, {
      signingSecret: env.MEDIA_DELIVERY_SIGNING_SECRET,
    });

    const publishedArtist = await catalogueRepo.findPublishedArtist(artist.slug);
    expect(publishedArtist?.artwork.src).toContain("/media/artwork/");

    const publishedRelease = await catalogueRepo.findPublishedRelease(release.slug);
    expect(publishedRelease?.artwork.src).toContain("/media/artwork/");

    const publishedTrack = await catalogueRepo.findPublishedTrack(release.slug, track.slug);
    expect(publishedTrack?.item.artwork.src).toContain("/media/artwork/");

    const publishedTracks = await catalogueRepo.listPublishedTracks();
    const trackItem = publishedTracks.find((item) => item.id === track.id);
    expect(trackItem?.artwork.src).toContain("/media/artwork/");

    const publishedCollection = await catalogueRepo.findPublishedCollection(collection.slug);
    expect(publishedCollection?.artwork?.src).toContain("/media/artwork/");

    const publishedCollections = await catalogueRepo.listPublishedCollections(publishedTracks);
    const collectionItem = publishedCollections.find((col) => col.id === collection.id);
    expect(collectionItem?.artwork?.src).toContain("/media/artwork/");
  });

  it("Gap #3: private master artwork remains hidden across all public catalogue surfaces", async () => {
    const [artist] = await db.select({ id: artists.id, slug: artists.slug }).from(artists).limit(1);
    const [release] = await db
      .select({ id: releases.id, slug: releases.slug })
      .from(releases)
      .limit(1);
    const [track] = await db.select({ id: tracks.id, slug: tracks.slug }).from(tracks).limit(1);
    const [collection] = await db
      .select({ id: editorialCollections.id, slug: editorialCollections.slug })
      .from(editorialCollections)
      .limit(1);

    const testContent = new Uint8Array([10, 20, 30, 40]);
    const hasher = new IncrementalSha256();
    hasher.update(testContent);
    const validChecksum = hasher.digestHex();

    const service = new MediaService(db, env, () => new Date("2026-08-16T12:00:00Z"));

    for (const target of [
      { type: "artist" as const, id: artist.id },
      { type: "release" as const, id: release.id },
      { type: "track" as const, id: track.id },
      { type: "collection" as const, id: collection.id },
    ]) {
      const created = await service.createSession(
        {
          kind: "artwork",
          scope: "private_master",
          mimeType: "image/webp",
          checksumSha256: validChecksum,
          byteSize: testContent.byteLength,
          width: 1000,
          height: 1000,
          targetEntityType: target.type,
          targetEntityId: target.id,
        },
        actor,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await service.upload(
        created.value.id,
        new Request("https://example.test/upload", {
          method: "PUT",
          headers: { "content-type": "image/webp" },
          body: testContent,
        }),
      );
      await service.complete(created.value.id);
    }

    const catalogueRepo = createCatalogueRepository(db, {
      signingSecret: env.MEDIA_DELIVERY_SIGNING_SECRET,
    });

    const publishedArtist = await catalogueRepo.findPublishedArtist(artist.slug);
    expect(publishedArtist?.artwork.src).toBe("/assets/favicon.svg");

    const publishedRelease = await catalogueRepo.findPublishedRelease(release.slug);
    expect(publishedRelease?.artwork.src).toBe("/assets/favicon.svg");

    const publishedTrack = await catalogueRepo.findPublishedTrack(release.slug, track.slug);
    expect(publishedTrack?.item.artwork.src).toBe("/assets/favicon.svg");

    const publishedCollection = await catalogueRepo.findPublishedCollection(collection.slug);
    expect(publishedCollection?.artwork).toBeUndefined();
  });

  it("atomically replaces an existing primary audio asset without violating uniqueness", async () => {
    const [track] = await db.select({ id: tracks.id }).from(tracks).limit(1);
    const testContent = new Uint8Array([11, 22, 33, 44, 55]);
    const hasher = new IncrementalSha256();
    hasher.update(testContent);
    const service = new MediaService(db, env, () => new Date("2026-08-16T12:00:00Z"));
    const created = await service.createSession(
      {
        kind: "audio",
        scope: "publishable_derivative",
        mimeType: "audio/mpeg",
        checksumSha256: hasher.digestHex(),
        byteSize: testContent.byteLength,
        durationMs: 120_000,
        codec: "mp3",
        targetEntityType: "track",
        targetEntityId: track.id,
      },
      actor,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const uploaded = await service.upload(
      created.value.id,
      new Request("https://example.test/upload", {
        method: "PUT",
        headers: { "content-type": "audio/mpeg" },
        body: testContent,
      }),
    );
    expect(uploaded.ok).toBe(true);

    const completed = await service.complete(created.value.id);
    expect(completed.ok).toBe(true);
    const primaryAssets = await db
      .select()
      .from(audioAssets)
      .where(
        and(
          eq(audioAssets.trackId, track.id),
          eq(audioAssets.scope, "publishable_derivative"),
          eq(audioAssets.isPrimary, true),
        ),
      );
    expect(primaryAssets).toHaveLength(1);
    if (!completed.ok) return;
    const [session] = await db
      .select({ objectKey: uploadSessions.objectKey })
      .from(uploadSessions)
      .where(eq(uploadSessions.id, created.value.id));
    expect(primaryAssets[0].id).toBe(completed.value.assetId);
    expect(primaryAssets[0].objectKey).toBe(session.objectKey);
  });

  it("Gap #7: complete() rejects expiresAt in past, creates no asset rows, and cleanup handles abandoned session", async () => {
    const [artist] = await db.select({ id: artists.id }).from(artists).limit(1);
    let now = new Date("2026-08-16T12:00:00Z");
    const service = new MediaService(db, env, () => now);
    const testContent = new Uint8Array([99, 98, 97, 96]);
    const hasher = new IncrementalSha256();
    hasher.update(testContent);
    const validChecksum = hasher.digestHex();

    const created = await service.createSession(
      {
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: validChecksum,
        byteSize: testContent.byteLength,
        width: 400,
        height: 400,
        targetEntityType: "artist",
        targetEntityId: artist.id,
      },
      actor,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const uploaded = await service.upload(
      created.value.id,
      new Request("https://example.test/upload", {
        method: "PUT",
        headers: { "content-type": "image/webp" },
        body: testContent,
      }),
    );
    expect(uploaded.ok).toBe(true);

    const artworkCountBefore = (await db.select().from(artworkAssets)).length;

    now = new Date(new Date(created.value.expiresAt).getTime() + 10_000);

    const completed = await service.complete(created.value.id);
    expect(completed).toEqual({
      ok: false,
      status: 409,
      message: "Upload session has expired.",
    });

    const artworkCountAfter = (await db.select().from(artworkAssets)).length;
    expect(artworkCountAfter).toBe(artworkCountBefore);

    const cleanedCount = await service.cleanupAbandoned();
    expect(cleanedCount).toBeGreaterThanOrEqual(1);

    const [sessionRow] = await db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, created.value.id));
    expect(sessionRow.status).toBe("abandoned");
    expect(sessionRow.failureReason).toBe("Expired before completion");
  });

  it("Gap #8: streams bounded-memory chunks and verifies checksums and byte sizes", async () => {
    const [artist] = await db.select({ id: artists.id }).from(artists).limit(1);
    const chunk1 = new Uint8Array([1, 2, 3, 4]);
    const chunk2 = new Uint8Array([5, 6, 7, 8]);
    const chunk3 = new Uint8Array([9, 10, 11, 12]);
    const totalBytes = chunk1.byteLength + chunk2.byteLength + chunk3.byteLength;

    const hasher = new IncrementalSha256();
    hasher.update(chunk1);
    hasher.update(chunk2);
    hasher.update(chunk3);
    const validChecksum = hasher.digestHex();

    const service = new MediaService(db, env, () => new Date("2026-08-16T12:00:00Z"));
    const created = await service.createSession(
      {
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: validChecksum,
        byteSize: totalBytes,
        width: 600,
        height: 600,
        targetEntityType: "artist",
        targetEntityId: artist.id,
      },
      actor,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.enqueue(chunk3);
        controller.close();
      },
    });

    const uploadRequest = new Request("https://example.test/upload", {
      method: "PUT",
      headers: { "content-type": "image/webp" },
      body: stream,
      duplex: "half",
    } as RequestInit);

    const uploaded = await service.upload(created.value.id, uploadRequest);
    expect(uploaded.ok).toBe(true);

    const createdMismatch = await service.createSession(
      {
        kind: "artwork",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: "f".repeat(64),
        byteSize: totalBytes,
        width: 600,
        height: 600,
        targetEntityType: "artist",
        targetEntityId: artist.id,
      },
      actor,
    );
    expect(createdMismatch.ok).toBe(true);
    if (!createdMismatch.ok) return;

    const mismatchStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.enqueue(chunk3);
        controller.close();
      },
    });

    const mismatchRequest = new Request("https://example.test/upload", {
      method: "PUT",
      headers: { "content-type": "image/webp" },
      body: mismatchStream,
      duplex: "half",
    } as RequestInit);

    const mismatchUpload = await service.upload(createdMismatch.value.id, mismatchRequest);
    expect(mismatchUpload).toEqual({
      ok: false,
      status: 400,
      message: "Checksum does not match the declaration.",
    });

    const [failedSession] = await db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, createdMismatch.value.id));
    expect(failedSession.status).toBe("failed");
    expect(failedSession.failureReason).toBe("Checksum mismatch");
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
        url: new URL(request.url),
        pattern: "/media/:kind/:assetId",
        params: { kind: "audio", assetId },
        context: mockContext,
      });

      expect(response.status).toBe(307);
      const location = response.headers.get("Location");
      expect(location).toContain(`/media/audio/${assetId}?expires=`);
      expect(location).toContain("&signature=");

      // The redirect target is signed and valid
      await expect(verifyMediaSignature(new URL(location!), secret)).resolves.toBe(true);
    });

    it("returns JSON when unsigned request specifies ?playback=true or Accept: application/json", async () => {
      const request = new Request(`https://example.com/media/audio/${assetId}?playback=true`, {
        headers: { Accept: "application/json" },
      });
      const response = await mediaLoader({
        request,
        url: new URL(request.url),
        pattern: "/media/:kind/:assetId",
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
      const signedUrl = await createMediaDeliveryUrl(
        "https://example.com",
        "audio",
        assetId,
        secret,
      );
      const request = new Request(signedUrl);
      const response = await mediaLoader({
        request,
        url: new URL(request.url),
        pattern: "/media/:kind/:assetId",
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
        url: new URL(request.url),
        pattern: "/media/:kind/:assetId",
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
