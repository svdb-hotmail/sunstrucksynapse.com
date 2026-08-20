import type {
  EvidenceUploadDeclaration,
  SubmissionAcceptInput,
  SubmissionClarificationInput,
  SubmissionDraftInput,
  SubmissionFilter,
  SubmissionNoteInput,
  SubmissionRejectInput,
  SubmissionRepository,
  SubmissionStatusTransitionInput,
} from "~/repositories/submissions.server";
import type { CuratorIdentity } from "~/types/curator";
import type { SubmissionStatus } from "~/types/submissions";

import type { TransactionalEmailService } from "./transactional-email.server";

export type SubmissionErrorCode =
  | "invalid"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "transition_conflict";

export type SubmissionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: SubmissionErrorCode; message: string } };

export function submissionHttpStatus(code: SubmissionErrorCode): number {
  switch (code) {
    case "not_found":
      return 404;
    case "forbidden":
      return 403;
    case "conflict":
    case "transition_conflict":
      return 409;
    case "invalid":
    default:
      return 400;
  }
}

const curatorTransitions: Readonly<Record<SubmissionStatus, readonly SubmissionStatus[]>> = {
  draft: [],
  received: ["eligibility_review", "clarification_requested", "rejected", "withdrawn"],
  eligibility_review: ["listening", "clarification_requested", "rejected", "withdrawn"],
  listening: ["clarification_requested", "accepted", "rejected", "withdrawn"],
  clarification_requested: ["eligibility_review", "listening", "rejected", "withdrawn"],
  accepted: [],
  rejected: [],
  withdrawn: [],
};

function missing(fields: string[]): string {
  return `Complete the required field${fields.length === 1 ? "" : "s"}: ${fields.join(", ")}.`;
}

function validateForSubmit(input: SubmissionDraftInput): string | null {
  const required: string[] = [];
  if (!input.workTitle.trim()) required.push("work title");
  if (!input.artist.displayName.trim()) required.push("artist name");
  if (!input.contact.contactName.trim()) required.push("contact name");
  if (!input.contact.contactEmail.trim()) required.push("contact email");
  if (!input.release.title.trim()) required.push("release title");
  if (input.submissionKind === "track" && !input.track.title.trim()) required.push("track title");
  if (!input.rights.entitlementStatement.trim()) required.push("entitlement statement");
  if (!input.rights.publicSummary.trim()) required.push("rights public summary");
  if (!input.rights.attestation.trim()) required.push("rights attestation");
  if (!input.process.meaningfulHumanContribution.trim())
    required.push("meaningful human contribution");
  if (!input.process.publicSummary.trim()) required.push("public process summary");
  if (!input.provenance.summary.trim()) required.push("provenance summary");
  if (!input.acknowledgements.invitationConfirmed) required.push("invitation acknowledgement");
  if (!input.acknowledgements.accuracyConfirmed) required.push("accuracy acknowledgement");
  if (!input.acknowledgements.rightsConfirmed) required.push("rights acknowledgement");
  if (!input.acknowledgements.disclosureConfirmed) required.push("disclosure acknowledgement");
  if (!input.acknowledgements.reviewProcessConfirmed)
    required.push("review process acknowledgement");
  if (input.process.aiUsed && !input.process.aiUseDescription.trim())
    required.push("AI use description");
  if (input.process.lyricsUsed && !input.process.lyricsDetails.trim())
    required.push("lyrics details");
  if (input.process.voiceCloneUsed && !input.process.voiceCloneDetails.trim())
    required.push("voice clone details");
  if (input.process.samplesUsed && !input.process.sampleDetails.trim())
    required.push("samples details");
  if (input.rights.containsThirdPartyMaterial && !input.rights.thirdPartyMaterialDetails.trim()) {
    required.push("third-party material details");
  }
  return required.length > 0 ? missing(required) : null;
}

export class SubmissionService {
  constructor(
    private readonly repository: SubmissionRepository,
    private readonly email: TransactionalEmailService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  loadInvitation(tokenHash: string) {
    return this.repository.findInvitationByTokenHash(tokenHash, this.clock());
  }

  loadPublic(tokenHash: string) {
    return this.repository.findByInvitationTokenHash(tokenHash, this.clock());
  }

  async saveDraft(
    tokenHash: string,
    input: SubmissionDraftInput,
    meta: { honeypotTriggered: boolean; userAgent: string | null; ipHash: string | null },
  ): Promise<SubmissionResult<unknown>> {
    const current = await this.repository.findByInvitationTokenHash(tokenHash, this.clock());
    if (
      current &&
      current.submission.status !== "draft" &&
      current.submission.status !== "clarification_requested"
    ) {
      return {
        ok: false,
        error: {
          code: "conflict",
          message: "This submission is no longer editable from the invitation link.",
        },
      };
    }
    const value = await this.repository.saveDraftByInvitationTokenHash(
      tokenHash,
      input,
      this.clock(),
      meta,
      current?.submission.status === "clarification_requested"
        ? "Clarification revision"
        : "Saved draft",
    );
    return value
      ? { ok: true, value }
      : { ok: false, error: { code: "not_found", message: "Submission link unavailable." } };
  }

  async submit(
    tokenHash: string,
    input: SubmissionDraftInput,
    meta: { honeypotTriggered: boolean; userAgent: string | null; ipHash: string | null },
  ) {
    const validation = validateForSubmit(input);
    if (validation) {
      return { ok: false, error: { code: "invalid", message: validation } } as const;
    }
    const value = await this.repository.submitByInvitationTokenHash(
      tokenHash,
      input,
      this.clock(),
      meta,
      "Submitted revision",
    );
    if (!value) {
      return {
        ok: false,
        error: { code: "not_found", message: "Submission link unavailable." },
      } as const;
    }
    await this.email.send({
      to: value.submission.submitterEmail,
      subject: `Submission received: ${value.submission.publicReference}`,
      textBody: `Your submission ${value.submission.publicReference} has been recorded for curator review.`,
    });
    await this.repository.recordEmailActivity(
      value.submission.id,
      this.clock(),
      value.submission.submitterEmail,
      "submission_received",
    );
    return {
      ok: true,
      value: (await this.repository.findByInvitationTokenHash(tokenHash, this.clock())) ?? value,
    } as const;
  }

  async withdraw(tokenHash: string, message: string | null) {
    const current = await this.repository.findByInvitationTokenHash(tokenHash, this.clock());
    if (!current) {
      return {
        ok: false,
        error: { code: "not_found", message: "Submission link unavailable." },
      } as const;
    }
    if (current.submission.status === "accepted" || current.submission.status === "rejected") {
      return {
        ok: false,
        error: { code: "conflict", message: "This submission can no longer be withdrawn." },
      } as const;
    }
    const value = await this.repository.withdrawByInvitationTokenHash(
      tokenHash,
      this.clock(),
      message,
    );
    return value
      ? { ok: true, value }
      : { ok: false, error: { code: "not_found", message: "Submission link unavailable." } };
  }

  listCurator(filter?: SubmissionFilter) {
    return this.repository.listCuratorSubmissions(filter);
  }

  findCuratorSubmission(submissionId: string) {
    return this.repository.findCuratorSubmission(submissionId);
  }

  assignCurator(submissionId: string, curator: CuratorIdentity) {
    return this.repository.assignCurator({
      submissionId,
      curator,
      assignedAt: this.clock(),
    });
  }

  async transition(input: SubmissionStatusTransitionInput): Promise<SubmissionResult<unknown>> {
    const current = await this.repository.findCuratorSubmission(input.submissionId);
    if (!current) {
      return { ok: false, error: { code: "not_found", message: "Submission not found." } };
    }
    if (!curatorTransitions[current.submission.status].includes(input.toStatus)) {
      return {
        ok: false,
        error: {
          code: "invalid",
          message: `Cannot move ${current.submission.status} to ${input.toStatus}.`,
        },
      };
    }
    const value = await this.repository.transitionStatus(input);
    return value
      ? { ok: true, value }
      : { ok: false, error: { code: "transition_conflict", message: "Submission changed." } };
  }

  addNote(input: SubmissionNoteInput) {
    return this.repository.addNote(input);
  }

  async requestClarification(input: SubmissionClarificationInput) {
    const value = await this.repository.addClarification(input);
    if (!value) {
      return { ok: false, error: { code: "not_found", message: "Submission not found." } } as const;
    }
    await this.email.send({
      to: value.submission.submitterEmail,
      subject: `Clarification requested: ${value.submission.publicReference}`,
      textBody: input.message,
    });
    await this.repository.recordEmailActivity(
      value.submission.id,
      input.createdAt,
      value.submission.submitterEmail,
      "clarification_requested",
    );
    return {
      ok: true,
      value: (await this.repository.findCuratorSubmission(value.submission.id)) ?? value,
    } as const;
  }

  async accept(input: SubmissionAcceptInput) {
    const current = await this.repository.findCuratorSubmission(input.submissionId);
    if (!current) {
      return { ok: false, error: { code: "not_found", message: "Submission not found." } } as const;
    }
    if (current.submission.status !== "listening") {
      return {
        ok: false,
        error: { code: "transition_conflict", message: "Submission changed." },
      } as const;
    }
    if (current.rights.authorityBasis === "other") {
      return {
        ok: false,
        error: { code: "invalid", message: "Accepted submissions cannot use “other” authority." },
      } as const;
    }
    const missingFields: string[] = [];
    if (current.rights.territories.length === 0) missingFields.push("territories");
    if (!current.process.publicSummary.trim()) missingFields.push("public process summary");
    if (current.process.aiUsed && current.process.aiTools.length === 0)
      missingFields.push("AI tools/models");
    if (current.process.humanRoles.length === 0) missingFields.push("human roles");
    if (!current.rights.entitlementStatement.trim()) missingFields.push("entitlement statement");
    if (
      current.rights.status !== "attested" ||
      current.process.status !== "finalized" ||
      current.provenance.status !== "finalized"
    ) {
      missingFields.push("final reviewed declaration revisions");
    }
    if (missingFields.length > 0) {
      return {
        ok: false,
        error: { code: "invalid", message: missing(missingFields) },
      } as const;
    }
    const value = await this.repository.acceptSubmission(input);
    if (!value) {
      return {
        ok: false,
        error: { code: "transition_conflict", message: "Submission changed." },
      } as const;
    }
    await this.email.send({
      to: value.submission.submitterEmail,
      subject: `Submission accepted: ${value.submission.publicReference}`,
      textBody: `Your submission ${value.submission.publicReference} has been accepted for curator preparation. Publication remains a separate manual decision.`,
    });
    await this.repository.recordEmailActivity(
      value.submission.id,
      input.acceptedAt,
      value.submission.submitterEmail,
      "submission_accepted",
    );
    return {
      ok: true,
      value: (await this.repository.findCuratorSubmission(value.submission.id)) ?? value,
    } as const;
  }

  async reject(input: SubmissionRejectInput) {
    const value = await this.repository.rejectSubmission(input);
    if (!value) {
      return { ok: false, error: { code: "not_found", message: "Submission not found." } } as const;
    }
    await this.email.send({
      to: value.submission.submitterEmail,
      subject: `Submission update: ${value.submission.publicReference}`,
      textBody: input.reason,
    });
    await this.repository.recordEmailActivity(
      value.submission.id,
      input.rejectedAt,
      value.submission.submitterEmail,
      "submission_rejected",
    );
    return {
      ok: true,
      value: (await this.repository.findCuratorSubmission(value.submission.id)) ?? value,
    } as const;
  }

  createEvidenceSession(tokenHash: string, declaration: EvidenceUploadDeclaration) {
    return this.repository.createEvidenceUploadSession(tokenHash, declaration, this.clock());
  }
}
