import { RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { cloudflareContext } from "../../app/config/cloudflare-context.server";
import { SITE_URL } from "../../app/config/brand";
import type { WorkerEnv } from "../../app/config/env.server";
import { createE2eCatalogueRepository } from "../../app/repositories/catalogue-fixture.server";
import { loader as videoLoader } from "../../app/routes/track-share-preview";
import { loader as pageLoader, meta } from "../../app/routes/track";
import { createSignedMediaPath } from "../../app/services/media-signing";
import { trackSharePreview } from "../../app/services/track-share-preview";

const params = {
  releaseSlug: "phase-zero-transmissions",
  trackSlug: "revolution-will-be-televised",
};
const secret = "test-share-signing-secret";

async function fixture() {
  const catalogueRepository = createE2eCatalogueRepository();
  const track = (await catalogueRepository.findPublishedTrack(
    params.releaseSlug,
    params.trackSlug,
  ))!;
  const preview = (await trackSharePreview(track.item))!;
  const head = vi.fn<WorkerEnv["MEDIA_BUCKET"]["head"]>().mockResolvedValue({
    size: 10,
    httpMetadata: { contentType: "video/mp4" },
  });
  const get = vi
    .fn<WorkerEnv["MEDIA_BUCKET"]["get"]>()
    .mockImplementation(async (_key, options) => {
      const partial = options.range.get("range") === "bytes=2-4";
      return {
        size: 10,
        httpEtag: '"preview"',
        body: new Response(partial ? "234" : "0123456789").body!,
        range: partial ? { offset: 2, length: 3 } : undefined,
        writeHttpMetadata() {},
      };
    });
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    catalogueRepository,
    ctx: {} as ExecutionContext,
    env: {
      DATABASE_URL: "postgres://localhost/test",
      ACCESS_TEAM_DOMAIN: "",
      ACCESS_AUD: "",
      CURATOR_EMAILS: "",
      MEDIA_DELIVERY_SIGNING_SECRET: secret,
      MEDIA_BUCKET: { head, get, put: vi.fn(), delete: vi.fn() },
    },
  });
  const args = {
    context,
    params: { ...params, previewFile: preview.file },
    request: new Request(SITE_URL + preview.path),
    url: new URL(SITE_URL + preview.path),
    pattern: preview.path,
  };
  return { args, track, catalogueRepository, preview, head, get };
}

describe("track share previews", () => {
  it("adds the video metadata to the same track URL and falls back when unavailable", async () => {
    const { args, preview, head } = await fixture();
    const metadata = async () => {
      const data = await pageLoader(args);
      return meta({ loaderData: data } as Parameters<typeof meta>[0]);
    };

    const tags = await metadata();
    expect(tags).toContainEqual({ property: "og:video", content: SITE_URL + preview.path });
    expect(tags).toContainEqual({ name: "twitter:card", content: "player" });
    expect(tags).toContainEqual({ property: "og:type", content: "music.song" });
    expect(tags).toContainEqual({
      property: "og:url",
      content: `${SITE_URL}/tracks/${params.releaseSlug}/${params.trackSlug}`,
    });
    head.mockResolvedValueOnce(null);
    expect(await metadata()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "og:video" })]),
    );
    head.mockRejectedValueOnce(new Error("R2 unavailable"));
    expect(await metadata()).toContainEqual({ property: "og:image", content: preview.artworkUrl });
  });

  it("serves fresh signed redirects, full responses, HEAD and byte ranges", async () => {
    const { args, get } = await fixture();
    const entry = await videoLoader(args);
    expect(entry.status).toBe(307);
    expect(get).not.toHaveBeenCalled();
    const signedUrl = new URL(entry.headers.get("location")!, args.url);
    const deliver = (init?: RequestInit) =>
      videoLoader({ ...args, request: new Request(signedUrl, init) });

    const full = await deliver();
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/mp4");
    expect(await full.text()).toBe("0123456789");

    const headers = await deliver({ method: "HEAD" });
    expect(headers.status).toBe(200);
    expect(headers.headers.get("content-length")).toBe("10");
    expect(await headers.text()).toBe("");

    const part = await deliver({ headers: { range: "bytes=2-4" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(await part.text()).toBe("234");
    const invalid = await deliver({ headers: { range: "bytes=10-" } });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe("bytes */10");
  });

  it("rejects expired, replaced and unpublished previews before reading the object", async () => {
    const { args, preview, track, catalogueRepository, get } = await fixture();
    const deliver = async (now?: Date) =>
      videoLoader({
        ...args,
        request: new Request(SITE_URL + (await createSignedMediaPath(preview.path, secret, now))),
      });
    expect((await deliver(new Date(0))).status).toBe(403);
    const find = vi.spyOn(catalogueRepository, "findPublishedTrack");
    find.mockResolvedValueOnce({
      ...track,
      item: { ...track.item, artwork: { ...track.item.artwork, src: "/assets/replacement.png" } },
    });
    expect((await deliver()).status).toBe(404);
    find.mockResolvedValueOnce(null);
    expect((await deliver()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it("keeps a managed cover's preview identity stable across signing renewals", async () => {
    const { track } = await fixture();
    const itemWithSignature = (signature: string) => ({
      ...track.item,
      artwork: { ...track.item.artwork, src: `/media/artwork/cover?signature=${signature}` },
    });
    const first = await trackSharePreview(itemWithSignature("first"));
    const second = await trackSharePreview(itemWithSignature("second"));
    expect(first).toEqual(second);
    expect(first?.artworkUrl).toBe(`${SITE_URL}/media/artwork/cover`);
  });
});
