import { describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { action } from "../../app/routes/curator-submissions";
import { createE2eSubmissionRepository } from "../../app/repositories/submissions-fixture.server";

vi.mock("../../app/services/access-auth.server", () => ({
  requireCuratorIdentity: async () => ({
    ok: true,
    identity: { id: "curator-1", email: "curator@example.test" },
  }),
}));

describe("durable review result", () => {
  it("returns saved decision even when claiming the following item fails", async () => {
    const finalizeReview = vi.fn().mockResolvedValue({ status: "accepted" });
    const runtime = {
      submissionRepository: createE2eSubmissionRepository(),
      curatorRepository: {},
      curationWorkflowRepository: {
        finalizeReview,
        claimNextSubmission: vi.fn().mockRejectedValue(new Error("Temporary database outage")),
      },
    };
    const form = new FormData();
    for (const [key, value] of Object.entries({
      intent: "grade",
      workspace: "1",
      submissionId: "20000000-0000-4000-8000-000000000001",
      artisticQuality: "4",
      originalityIntent: "4",
      productionReadiness: "4",
      editorialFit: "4",
      finalGrade: "B",
      rationale: "A deliberate signal suited to the station.",
    }))
      form.set(key, value);
    const response = await action({
      request: new Request("https://example.test/curator/submissions", {
        method: "POST",
        body: form,
      }),
      context: { get: () => runtime },
      params: {},
    } as unknown as ActionFunctionArgs);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      finalizedId: "20000000-0000-4000-8000-000000000001",
      claimedId: null,
      nextWarning: expect.stringContaining("Saved successfully"),
    });
    expect(finalizeReview).toHaveBeenCalledOnce();
  });
});
