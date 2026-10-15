import { beforeEach, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { loader } from "../../app/routes/curator-prepared-audio";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), audio: vi.fn(), get: vi.fn() }));
vi.mock("../../app/services/access-auth.server", () => ({
  requireCuratorIdentity: (...args: unknown[]) => mocks.auth(...args),
}));
vi.mock("../../app/repositories/release-preparation.server", () => ({
  createReleasePreparationRepository: () => ({ audioForCurator: mocks.audio }),
}));
const id = "10000000-0000-4000-8000-000000000001";
function args(range?: string): LoaderFunctionArgs {
  return {
    request: new Request("https://example.test/curator/prepared-audio/" + id, {
      headers: range ? { range } : {},
    }),
    params: { trackId: id },
    context: { get: () => ({ db: {}, env: { MEDIA_BUCKET: { get: mocks.get } } }) },
  } as unknown as LoaderFunctionArgs;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, identity: { id: "curator" } });
  mocks.audio.mockResolvedValue({
    objectKey: "private/streaming-preparation/test/lease.mp3",
    byteSize: 100,
    mimeType: "audio/mpeg",
    filename: 'Test "track".mp3',
  });
  mocks.get.mockResolvedValue({
    body: new Blob(["mp3"]).stream(),
    range: { offset: 0, length: 3 },
    writeHttpMetadata: () => {},
  });
});
it("blocks unauthenticated access before looking up private derivatives", async () => {
  mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
  expect((await loader(args())).status).toBe(403);
  expect(mocks.audio).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
});
it("allows private curator audition with byte ranges and no caching", async () => {
  const response = await loader(args("bytes=0-2"));
  expect(response.status).toBe(206);
  expect(response.headers.get("content-range")).toBe("bytes 0-2/100");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-type")).toBe("audio/mpeg");
  expect(await response.text()).toBe("mp3");
});
it.each(["bytes=100-101", "bytes=3-2", "bytes=-0", "bytes=0-1,4-5"])(
  "rejects invalid range %s before storage access",
  async (range) => {
    const response = await loader(args(range));
    expect(response.status).toBe(416);
    expect(mocks.get).not.toHaveBeenCalled();
  },
);
