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

it("returns the saved private cover URL immediately after a successful save", async () => {
  const { args } = context();
  const id = args.params.submissionId;
  const coverId = "40000000-0000-4000-8000-000000000001";
  mocks.auth.mockResolvedValue({
    ok: true,
    identity: { id: "curator", email: "curator@example.test" },
  });
  mocks.find.mockResolvedValue({ editable: true, revision: {} });
  mocks.save.mockResolvedValue({ id, coverId, revision: { cover: coverId } });
  const fields = new URLSearchParams({
    title: "Track",
    releaseTitle: "Release",
    summary: "",
    revision: "{}",
    reason: "Metadata correction",
  });
  const response = await action({
    ...args,
    request: new Request(url, {
      method: "POST",
      headers: { "content-length": String(fields.toString().length) },
      body: fields,
    }),
  } as unknown as ActionFunctionArgs);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    savedRevision: JSON.stringify({ cover: coverId }),
    savedCoverUrl: `/curator/submissions/${id}/artwork?v=${coverId}`,
  });
});

const liveFields = {
  title: "Track",
  releaseTitle: "Release",
  summary: "Description",
  genres: ["Ambient"],
  moods: ["Calm"],
  processTags: ["Mixing"],
};
function liveForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries(liveFields)) {
    if (Array.isArray(value)) for (const item of value) form.append(key, item);
    else form.set(key, value);
  }
  form.set("revision", "{}");
  form.set("reason", "Correct published discovery tags");
  return form;
}
async function submitLive(form: FormData, args: ReturnType<typeof context>["args"]) {
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
function authorizeLive() {
  mocks.auth.mockResolvedValue({
    ok: true,
    identity: { id: "curator", email: "curator@example.test" },
  });
  mocks.find.mockResolvedValue({
    editable: false,
    discoveryEditable: true,
    revision: {},
    fields: liveFields,
  });
}
it("allows an authenticated, revision-checked discovery correction on a published track", async () => {
  const { args, bucket } = context();
  authorizeLive();
  mocks.save.mockResolvedValue({
    id: args.params.submissionId,
    coverId: null,
    revision: { track: "updated" },
  });
  const form = liveForm();
  form.set("genres", "Electronic");
  form.set("moods", "Dreamy");
  form.set("processTags", "Human composition");
  const response = await submitLive(form, args);
  expect(response.status).toBe(200);
  expect(mocks.save).toHaveBeenCalledWith(
    args.params.submissionId,
    "{}",
    {
      ...liveFields,
      genres: ["Electronic"],
      moods: ["Dreamy"],
      processTags: ["Human composition"],
    },
    "Correct published discovery tags",
    { id: "curator", email: "curator@example.test" },
    undefined,
  );
  expect(bucket.put).not.toHaveBeenCalled();
});
it.each([
  "title",
  "releaseTitle",
  "summary",
  "cover",
  "revision",
  "reason",
  "genres",
  "moods",
  "processTags",
])(
  "rejects a forbidden or invalid published edit to %s before saving or uploading",
  async (field) => {
    const { args, bucket } = context();
    authorizeLive();
    const form = liveForm();
    if (field === "cover") {
      form.set("cover", new File(["synthetic"], "cover.png", { type: "image/png" }));
      form.set("artworkPermission", "yes");
    } else if (["genres", "moods", "processTags", "reason"].includes(field)) form.delete(field);
    else form.set(field, field === "revision" ? '{"track":"stale"}' : "Forged protected field");
    const response = await submitLive(form, args);
    expect(response.status).toBe(409);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
  },
);
it("exposes discovery permission in the loader and preserves the closed-record action gate", async () => {
  const { args } = context();
  authorizeLive();
  const loaded = await loader({
    ...args,
    request: new Request(url),
  } as unknown as LoaderFunctionArgs);
  expect(loaded).toMatchObject({ data: { editable: false, discoveryEditable: true } });
  mocks.find.mockResolvedValue({
    editable: false,
    discoveryEditable: false,
    revision: {},
    fields: liveFields,
  });
  const response = await submitLive(liveForm(), args);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "This submission is read-only." });
  expect(mocks.save).not.toHaveBeenCalled();
});

it.each([
  { name: "multiline description", fields: { ...liveFields, summary: "First line\nSecond line" } },
  {
    name: "protected whitespace",
    fields: {
      ...liveFields,
      title: " Track ",
      releaseTitle: " Release ",
      summary: "\n  Description  \n",
    },
  },
  {
    name: "maximum-length multiline description",
    fields: { ...liveFields, summary: "First\n" + "x".repeat(4994) },
  },
  {
    name: "native single-line title values",
    fields: { ...liveFields, title: "First\nTitle", releaseTitle: "Release\r\nTitle" },
  },
])(
  "preserves exact protected text for a multipart discovery edit with $name",
  async ({ fields }) => {
    const { args, bucket } = context();
    authorizeLive();
    mocks.find.mockResolvedValue({
      editable: false,
      discoveryEditable: true,
      revision: {},
      fields,
    });
    mocks.save.mockResolvedValue({
      id: args.params.submissionId,
      coverId: null,
      revision: { track: "updated" },
    });
    const form = liveForm();
    form.set("title", fields.title.replace(/[\r\n]/g, ""));
    form.set("releaseTitle", fields.releaseTitle.replace(/[\r\n]/g, ""));
    form.set("summary", fields.summary);
    form.set("processTags", "Human composition");
    const encoded = new Request(url, { method: "POST", body: form });
    const decoded = await encoded.formData();
    expect(decoded.get("summary")).toBe(fields.summary.replace(/\r\n?|\n/g, "\r\n"));
    expect((await submitLive(form, args)).status).toBe(200);
    expect(mocks.save.mock.calls[0][2]).toEqual({ ...fields, processTags: ["Human composition"] });
    expect(bucket.put).not.toHaveBeenCalled();
  },
);

it("preserves shared read-only release text during a pre-acceptance track correction", async () => {
  const { args } = context();
  authorizeLive();
  const fields = {
    ...liveFields,
    releaseTitle: " Shared album ",
    summary: "\nFirst line\nSecond line\n",
  };
  mocks.find.mockResolvedValue({
    editable: true,
    discoveryEditable: true,
    releaseFieldsEditable: false,
    revision: {},
    fields,
  });
  mocks.save.mockResolvedValue({
    id: args.params.submissionId,
    coverId: null,
    revision: { track: "updated" },
  });
  const form = liveForm();
  form.set("title", "Corrected track title");
  form.set("releaseTitle", fields.releaseTitle);
  form.set("summary", fields.summary);
  expect((await submitLive(form, args)).status).toBe(200);
  expect(mocks.save.mock.calls[0][2]).toEqual({ ...fields, title: "Corrected track title" });
});

it.each(["title", "releaseTitle", "summary"])(
  "still rejects actual protected %s whitespace changes",
  async (field) => {
    const { args, bucket } = context();
    authorizeLive();
    const form = liveForm();
    form.set(field, " " + liveFields[field as "title" | "releaseTitle" | "summary"]);
    expect((await submitLive(form, args)).status).toBe(409);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
  },
);
