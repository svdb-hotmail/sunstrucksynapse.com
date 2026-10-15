import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { action } from "../../app/routes/curator-submissions";
import {
  createE2eSubmissionRepository,
  e2eReviewSubmissionId,
} from "../../app/repositories/submissions-fixture.server";

vi.mock("../../app/services/access-auth.server", () => ({
  requireCuratorIdentity: async () => ({
    ok: true,
    identity: { id: "curator-1", email: "curator@example.test" },
  }),
}));

describe("durable review result", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(["publish", "queue"])(
    "keeps an accepted track available for %s without publishing it",
    async (afterDecision) => {
      const trackId = "90000000-0000-4000-8000-000000000001";
      const finalizeReview = vi
        .fn()
        .mockResolvedValue({ status: "accepted", resultingTrackId: trackId });
      const claimNextSubmission = vi.fn().mockResolvedValue(null);
      const form = new FormData();
      Object.entries({
        intent: "grade",
        workspace: "1",
        afterDecision,
        submissionId: e2eReviewSubmissionId,
        artisticQuality: "4",
        originalityIntent: "4",
        productionReadiness: "4",
        editorialFit: "4",
        finalGrade: "B",
        rationale: "A deliberate signal suited to the station.",
      }).forEach(([key, value]) => form.set(key, value));
      const response = await action({
        request: new Request("https://example.test/curator/submissions", {
          method: "POST",
          body: form,
        }),
        context: {
          get: () => ({
            submissionRepository: createE2eSubmissionRepository(),
            curatorRepository: {},
            curationWorkflowRepository: { finalizeReview, claimNextSubmission },
          }),
        },
        params: {},
      } as unknown as ActionFunctionArgs);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject(
        afterDecision === "publish"
          ? { publishingTrackId: trackId }
          : { acceptedTrackId: trackId, claimedId: null },
      );
      expect(finalizeReview).toHaveBeenCalledOnce();
      expect(claimNextSubmission).toHaveBeenCalledTimes(afterDecision === "publish" ? 0 : 1);
    },
  );

  it("returns the saved question and a visible warning when configured email delivery fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const repository = createE2eSubmissionRepository();
    const runtime = {
      submissionRepository: repository,
      curatorRepository: {},
      env: {
        POSTMARK_SERVER_TOKEN: "synthetic-provider-token",
        TRANSACTIONAL_EMAIL_FROM: "sender@example.test",
      },
      curationWorkflowRepository: { claimNextSubmission: vi.fn().mockResolvedValue(null) },
    };
    const form = new FormData();
    for (const [key, value] of Object.entries({
      intent: "clarify",
      workspace: "1",
      submissionId: e2eReviewSubmissionId,
      claimKey: "rights.authorityBasis",
      message: "Please clarify permission.",
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
      clarifiedId: e2eReviewSubmissionId,
      notificationWarning: expect.stringContaining("email delivery failed"),
    });
    const saved = await repository.findCuratorSubmission(e2eReviewSubmissionId);
    expect(saved?.activities).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: "Please clarify permission." })]),
    );
  });

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
