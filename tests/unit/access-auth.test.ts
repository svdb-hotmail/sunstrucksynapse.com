import { describe, expect, it } from "vitest";

import { requireCuratorIdentity } from "../../app/services/access-auth.server";

describe("curator Access authentication", () => {
  it("rejects requests without an Access identity", async () => {
    const result = await requireCuratorIdentity(new Request("https://example.test/curator"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await result.response.text()).toBe("Authentication required.");
    }
  });

  it("accepts the explicit test-only identity and normalizes its email", async () => {
    const request = new Request("https://example.test/curator", {
      headers: { "x-test-curator-identity": "actor-7|CURATOR@EXAMPLE.TEST" },
    });

    await expect(requireCuratorIdentity(request)).resolves.toEqual({
      ok: true,
      identity: { id: "actor-7", email: "curator@example.test" },
    });
  });

  it("fails malformed test identities safely", async () => {
    const request = new Request("https://example.test/curator", {
      headers: { "x-test-curator-identity": "not-an-identity" },
    });

    const result = await requireCuratorIdentity(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});
