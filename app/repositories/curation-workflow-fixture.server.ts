import type { CuratorIdentity } from "~/types/curator";

import type {
  CurationReviewInput,
  CurationReviewResult,
  CurationWorkflowRepository,
  ReviewAudioRecord,
} from "./curation-workflow.server";
import type { SubmissionRepository } from "./submissions.server";
import { e2eReviewSubmissionId } from "./submissions-fixture.server";

type CuratorCurationWorkflowRepository = Pick<
  CurationWorkflowRepository,
  "claimNextSubmission" | "finalizeReview" | "currentAudioForSubmissions"
>;

const reviewAudio: ReviewAudioRecord = {
  id: "b0000000-0000-4000-8000-000000000902",
  submissionId: e2eReviewSubmissionId,
  version: 1,
  objectKey: `private/review-audio/final/${e2eReviewSubmissionId}/review-signal`,
  filename: "unwritten-frequency.flac",
  mimeType: "audio/flac",
  checksumSha256: "b".repeat(64),
  byteSize: 4096,
  durationMs: 180000,
  codec: "flac",
  finalizedAt: new Date("2026-09-07T10:10:00Z"),
};

export function createE2eCurationWorkflowRepository(
  submissions: SubmissionRepository,
): CuratorCurationWorkflowRepository {
  return {
    async claimNextSubmission(curator: CuratorIdentity, now: Date) {
      const assigned = await submissions.listCuratorSubmissions({
        status: "listening",
        assignedTo: curator.email,
      });
      if (assigned[0]) return assigned[0].submission.id;

      const candidates = await submissions.listCuratorSubmissions({ status: "eligibility_review" });
      const candidate = candidates.find(
        ({ submission, rights, process, provenance }) =>
          submission.id === e2eReviewSubmissionId &&
          rights.status === "attested" &&
          process.status === "finalized" &&
          provenance.status === "finalized",
      );
      if (!candidate) return null;
      await submissions.assignCurator({
        submissionId: candidate.submission.id,
        curator,
        assignedAt: now,
      });
      const claimed = await submissions.transitionStatus({
        submissionId: candidate.submission.id,
        actor: curator,
        toStatus: "listening",
        transitionedAt: now,
      });
      return claimed?.submission.id ?? null;
    },

    async finalizeReview(
      input: CurationReviewInput,
      curator: CuratorIdentity,
      now: Date,
    ): Promise<CurationReviewResult | null> {
      const current = await submissions.findCuratorSubmission(input.submissionId);
      if (
        !current ||
        current.submission.status !== "listening" ||
        current.submission.assignedCuratorId !== curator.id ||
        input.submissionId !== reviewAudio.submissionId
      ) {
        return null;
      }
      const accepted = input.finalGrade !== "C";
      const decided = accepted
        ? await submissions.acceptSubmission({
            submissionId: input.submissionId,
            actor: curator,
            acceptedAt: now,
            note: input.rationale,
            resultingTrackId: crypto.randomUUID(),
          })
        : await submissions.rejectSubmission({
            submissionId: input.submissionId,
            actor: curator,
            rejectedAt: now,
            reason: input.rationale,
          });
      if (!decided) return null;
      return {
        reviewId: crypto.randomUUID(),
        submissionId: input.submissionId,
        publicReference: decided.submission.publicReference,
        status: accepted ? "accepted" : "rejected",
        finalGrade: input.finalGrade,
        resultingTrackId: accepted ? decided.submission.resultingTrackId : null,
      };
    },

    async currentAudioForSubmissions(submissionIds: readonly string[]) {
      return submissionIds.includes(reviewAudio.submissionId)
        ? { [reviewAudio.submissionId]: structuredClone(reviewAudio) }
        : {};
    },
  };
}
