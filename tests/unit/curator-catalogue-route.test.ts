import { describe, expect, it, vi } from "vitest";
import { RouterContextProvider, type LoaderFunctionArgs } from "react-router";
import { cloudflareContext } from "../../app/config/cloudflare-context.server";
import { createE2eCatalogueRepository } from "../../app/repositories/catalogue-fixture.server";
import { loader } from "../../app/routes/curator";
import { fixtureCataloguePage } from "../../app/features/curator-workspace/catalogue-fixtures";
import type { WorkerEnv } from "../../app/config/env.server";

function args(query = "", authenticated = true, fails = false) {
  const read = vi.fn(async (query) => {
    if (fails) throw new Error("secret database URL must never reach a response");
    return fixtureCataloguePage(query);
  });
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    catalogueRepository: createE2eCatalogueRepository(),
    curatorCatalogueRepository: { read },
    env: { CURATOR_EMAILS: "curator@example.test" } as WorkerEnv,
    ctx: {} as ExecutionContext,
  });
  const url = new URL(`https://example.test/curator${query}`);
  const request = new Request(url, {
    headers: authenticated ? { "x-test-curator-identity": "actor|curator@example.test" } : {},
  });
  return {
    read,
    input: { request, url, context, params: {}, pattern: "/curator" } as LoaderFunctionArgs,
  };
}

describe("catalogue loader authorization and failures", () => {
  it("does not query private inventory without curator authentication", async () => {
    const { read, input } = args("", false);
    await expect(loader(input)).rejects.toMatchObject({ status: 401 });
    expect(read).not.toHaveBeenCalled();
  });
  it("rejects malformed cursors before querying", async () => {
    const { read, input } = args("?after=broken");
    await expect(loader(input)).rejects.toMatchObject({ status: 400 });
    expect(read).not.toHaveBeenCalled();
  });
  it("reports unavailable verification instead of fabricating non-live states", async () => {
    const { input } = args("", true, true);
    const error = await loader(input).catch((e) => e as Response);
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(503);
    expect(await (error as Response).text()).toBe("Catalogue temporarily unavailable.");
  });
});
