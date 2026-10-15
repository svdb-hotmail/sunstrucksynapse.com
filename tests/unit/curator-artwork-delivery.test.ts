import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createRequestHandler,
  RouterContextProvider,
  type ServerBuild,
  type LoaderFunctionArgs,
} from "react-router";
import routeConfig from "../../app/routes";
import * as preparedAudioRoute from "../../app/routes/curator-prepared-audio";
import * as artworkRoute from "../../app/routes/curator-submission-artwork";
import { loader as editorLoader } from "../../app/routes/curator-submission-edit";
import {
  cloudflareContext,
  type CloudflareContextValue,
} from "../../app/config/cloudflare-context.server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), get: vi.fn(), audio: vi.fn() }));
vi.mock("../../app/services/access-auth.server", () => ({ requireCuratorIdentity: mocks.auth }));
vi.mock("../../app/repositories/submission-edit.server", () => ({
  createSubmissionEditRepository: () => ({ find: mocks.find }),
}));
vi.mock("../../app/repositories/release-preparation.server", () => ({
  createReleasePreparationRepository: () => ({ audioForCurator: mocks.audio }),
}));
const id = "20000000-0000-4000-8000-000000000001";
const coverId = "40000000-0000-4000-8000-000000000001";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=",
  "base64",
);
const document = vi.fn(
  () => new Response("HTML page", { headers: { "content-type": "text/html" } }),
);
function runtime() {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    db: {},
    env: { MEDIA_BUCKET: { get: mocks.get } },
  } as unknown as CloudflareContextValue);
  return context;
}
function handler(file = "routes/curator-submission-artwork.ts", module = artworkRoute) {
  const configured = routeConfig.find((r) => r.file === file);
  expect(configured).toBeDefined();
  // Exercise the real framework request handler and actual registered module.
  // A loader-only unit test cannot detect a binary loader being rendered as HTML.
  const build: ServerBuild = {
    entry: { module: { default: document } },
    routes: {
      root: { id: "root", path: "", module: { default: () => null } },
      artwork: {
        id: "artwork",
        parentId: "root",
        path: configured!.path,
        module: module as unknown as NonNullable<ServerBuild["routes"][string]>["module"],
      },
    },
    assets: {
      entry: { imports: [], module: "" },
      routes: {},
      url: "/manifest.js",
      version: "test",
    },
    publicPath: "/",
    assetsBuildDirectory: "build/client",
    future: {},
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: "initial", manifestPath: "/__manifest" },
  };
  return createRequestHandler(build, "test");
}
beforeEach(() => {
  mocks.auth.mockResolvedValue({
    ok: true,
    identity: { id: "curator", email: "curator@example.test" },
  });
  mocks.find.mockResolvedValue({
    id,
    revision: { cover: coverId },
    coverId,
    coverObjectKey: "private/curator-artwork/test",
    coverMimeType: "image/png",
  });
  mocks.get.mockImplementation(async () => ({ body: new Blob([png]).stream(), size: png.length }));
});
afterEach(() => vi.resetAllMocks());
it("serves a saved cover as exact image bytes through the registered React Router resource route", async () => {
  const loaded = await editorLoader({
    request: new Request(`https://example.test/curator/submissions/${id}/edit`),
    params: { submissionId: id },
    context: runtime(),
  } as unknown as LoaderFunctionArgs);
  expect(loaded).not.toBeInstanceOf(Response);
  if (loaded instanceof Response) throw new Error("Expected editor data");
  expect(loaded.data.coverUrl).toBe(`/curator/submissions/${id}/artwork?v=${coverId}`);
  const request = new Request(new URL(loaded.data.coverUrl!, "https://example.test"), {
    headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
  });
  const response = await handler()(request, runtime());
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
  expect(document).not.toHaveBeenCalled();
  expect(mocks.get).toHaveBeenCalledWith("private/curator-artwork/test", expect.anything());
});
it("redirects old editor preview URLs to the authenticated image resource", async () => {
  const result = await editorLoader({
    request: new Request(`https://example.test/curator/submissions/${id}/edit?cover=1`),
    params: { submissionId: id },
    context: runtime(),
  } as unknown as LoaderFunctionArgs);
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(`/curator/submissions/${id}/artwork?v=${coverId}`);
});
it("authenticates image delivery before database and storage access", async () => {
  mocks.auth.mockResolvedValue({
    ok: false,
    response: new Response("Authentication required.", { status: 401 }),
  });
  const response = await handler()(
    new Request(`https://example.test/curator/submissions/${id}/artwork`),
    runtime(),
  );
  expect(response.status).toBe(401);
  expect(mocks.find).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
});
it("returns 404 for invalid IDs, missing selection, and missing storage objects", async () => {
  const request = handler();
  expect(
    (
      await request(
        new Request("https://example.test/curator/submissions/invalid/artwork"),
        runtime(),
      )
    ).status,
  ).toBe(404);
  expect(mocks.find).not.toHaveBeenCalled();
  mocks.find.mockResolvedValueOnce(null);
  expect(
    (
      await request(
        new Request(`https://example.test/curator/submissions/${id}/artwork`),
        runtime(),
      )
    ).status,
  ).toBe(404);
  expect(mocks.get).not.toHaveBeenCalled();
  mocks.get.mockResolvedValueOnce(null);
  expect(
    (
      await request(
        new Request(`https://example.test/curator/submissions/${id}/artwork`),
        runtime(),
      )
    ).status,
  ).toBe(404);
});

it("streams the prepared preview through the framework with byte ranges for playback and seeking", async () => {
  const bytes = new Uint8Array(1024).fill(7);
  mocks.audio.mockResolvedValue({
    objectKey: "private/streaming-preparation/synthetic.mp3",
    byteSize: 2048,
    mimeType: "audio/mpeg",
    filename: "Synthetic.mp3",
  });
  mocks.get.mockResolvedValue({
    body: new Blob([bytes]).stream(),
    size: 2048,
    range: { offset: 0, length: 1024 },
    httpEtag: '"synthetic"',
    writeHttpMetadata: () => {},
  });
  const response = await handler("routes/curator-prepared-audio.ts", preparedAudioRoute)(
    new Request(`https://example.test/curator/prepared-audio/${id}`, {
      headers: { range: "bytes=0-1023" },
    }),
    runtime(),
  );
  expect(response.status).toBe(206);
  expect(response.headers.get("content-type")).toBe("audio/mpeg");
  expect(response.headers.get("content-range")).toBe("bytes 0-1023/2048");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  expect(document).not.toHaveBeenCalled();
});
