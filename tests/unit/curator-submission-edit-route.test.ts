import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { action, loader } from "../../app/routes/curator-submission-edit";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), save: vi.fn() }));
vi.mock("../../app/services/access-auth.server", () => ({ requireCuratorIdentity: mocks.auth }));
vi.mock("../../app/repositories/submission-edit.server", () => ({
  createSubmissionEditRepository: () => ({ find: mocks.find, save: mocks.save }),
}));
afterEach(() => vi.resetAllMocks());
const url = "https://example.test/curator/submissions/20000000-0000-4000-8000-000000000001/edit";
function context() {
  const bucket = { put: vi.fn().mockResolvedValue({ size: 33 }), delete: vi.fn() };
  return {
    bucket,
    args: {
      context: {
        get: () => ({
          db: {},
          env: {
            MEDIA_BUCKET: bucket,
            AUDIO_ENCODER: {
              fetch: async (_url: string, init: RequestInit) => {
                const bytes = Buffer.from(await (init.body as Blob).arrayBuffer());
                return Response.json({
                  width: 1400,
                  height: 1400,
                  mimeType: "image/png",
                  byteSize: bytes.length,
                  checksumSha256: createHash("sha256").update(bytes).digest("hex"),
                });
              },
            },
          },
        }),
      },
      params: { submissionId: "20000000-0000-4000-8000-000000000001" },
    },
  };
}
it("authenticates editing and private cover reads before any database or storage access", async () => {
  const { args, bucket } = context();
  const response = new Response("Authentication required", { status: 401 });
  mocks.auth.mockResolvedValue({ ok: false, response });
  await expect(
    loader({ ...args, request: new Request(url + "?cover=1") } as unknown as LoaderFunctionArgs),
  ).rejects.toBe(response);
  await expect(
    action({
      ...args,
      request: new Request(url, { method: "POST" }),
    } as unknown as ActionFunctionArgs),
  ).rejects.toBe(response);
  expect(mocks.find).not.toHaveBeenCalled();
  expect(bucket.put).not.toHaveBeenCalled();
});
it("rejects cross-origin edits and requires an artwork permission acknowledgement", async () => {
  const { args, bucket } = context();
  mocks.auth.mockResolvedValue({
    ok: true,
    identity: { id: "curator", email: "curator@example.test" },
  });
  const denied = await action({
    ...args,
    request: new Request(url, { method: "POST", headers: { origin: "https://other.test" } }),
  } as unknown as ActionFunctionArgs);
  expect(denied.status).toBe(403);
  mocks.find.mockResolvedValue({ editable: true, revision: {} });
  const form = new FormData();
  Object.entries({
    title: "Track",
    releaseTitle: "Release",
    summary: "",
    revision: "{}",
    reason: "Artist supplied artwork",
  }).forEach(([k, v]) => form.set(k, v));
  const png = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").copy(png);
  png.writeUInt32BE(1400, 16);
  png.writeUInt32BE(1400, 20);
  form.set("cover", new File([png], "cover.png", { type: "image/png" }));
  async function submit() {
    const encoded = new Request(url, { method: "POST", body: form });
    const body = await encoded.arrayBuffer();
    return action({
      ...args,
      request: new Request(url, {
        method: "POST",
        headers: {
          "content-type": encoded.headers.get("content-type")!,
          "content-length": String(body.byteLength),
          origin: "https://example.test",
        },
        body,
      }),
    } as unknown as ActionFunctionArgs);
  }
  expect((await submit()).status).toBe(409);
  expect(bucket.put).not.toHaveBeenCalled();
  form.set("artworkPermission", "yes");
  mocks.save.mockRejectedValue(new Error("Database completion response lost"));
  expect((await submit()).status).toBe(409);
  expect(bucket.put).toHaveBeenCalledOnce();
  expect(bucket.delete).not.toHaveBeenCalled(); // An unknown commit must not erase a selected cover.
});
