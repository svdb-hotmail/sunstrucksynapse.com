import { it, expect, vi, beforeEach } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { loader } from "../../app/routes/curator-albums";
const mocks = vi.hoisted(() => ({
  revision: vi.fn(),
  inventory: vi.fn(),
  readiness: vi.fn(),
  list: vi.fn(),
}));
vi.mock("../../app/repositories/album-publishing.server", () => ({
  createAlbumPublishingRepository: () => ({
    publicationRevision: mocks.revision,
    inventory: mocks.inventory,
    readiness: mocks.readiness,
  }),
}));
vi.mock("../../app/services/access-auth.server", () => ({
  requireCuratorIdentity: async () => ({
    ok: true,
    identity: { id: "curator", email: "curator@example.test" },
  }),
}));
const id = "20000000-0000-4000-8000-000000000001";
function load() {
  return loader({
    request: new Request(`https://example.test/curator/albums?album=${id}`),
    params: {},
    context: {
      get: () => ({
        db: { execute: async () => ({ rows: [] }) },
        curatorRepository: { list: mocks.list },
      }),
    },
  } as unknown as LoaderFunctionArgs);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.inventory.mockResolvedValue([]);
  mocks.readiness.mockResolvedValue([]);
  mocks.list.mockResolvedValue([{ id, title: "Consistent details" }]);
});
it("reloads visible details if the confirmation revision changes during the read", async () => {
  mocks.revision.mockResolvedValueOnce("old").mockResolvedValueOnce("new").mockResolvedValue("new");
  const result = await load();
  expect(result.publicationRevision).toBe("new");
  expect(mocks.inventory).toHaveBeenCalledTimes(2);
  expect(mocks.list).toHaveBeenCalledTimes(4);
});
it("does not return an inconsistent confirmation during continuous concurrent changes", async () => {
  let revision = 0;
  mocks.revision.mockImplementation(async () => String(revision++));
  await expect(load()).rejects.toMatchObject({ status: 503 });
});
