import { beforeEach, describe, expect, it } from "vitest";

import {
  createE2eSubmissionRepository,
  e2eSubmissionInvitationToken,
} from "../../app/repositories/submissions-fixture.server";
import type { SubmissionDraftInput } from "../../app/repositories/submissions.server";
import { sha256Hex } from "../../app/services/submission-security.server";
import { SubmissionService } from "../../app/services/submissions.server";
import { createTransactionalEmailService } from "../../app/services/transactional-email.server";

function completeDraft(overrides: Partial<SubmissionDraftInput> = {}): SubmissionDraftInput {
  return {
    submissionKind: "track",
    workTitle: "Orbit Glass",
    artist: {
      displayName: "Invited Artist",
      shortBiography: "Producer and songwriter.",
      location: "Berlin",
      websiteUrl: "https://artist.example.test",
      socialUrl: "",
      priorWorkNotes: "",
    },
    release: {
      title: "Orbit Glass EP",
      summary: "A compact release for review.",
      plannedReleaseDate: "2026-10-01",
      labelName: "",
      distributorName: "Independent",
      distributorReleaseId: "ORBIT-001",
      territories: ["Worldwide"],
    },
    track: {
      title: "Orbit Glass",
      versionTitle: "",
      durationNotes: "Approx. four minutes.",
      isLeadSingle: true,
      lyricsSummary: "",
      isInstrumental: false,
    },
    contact: {
      contactName: "Invited Artist",
      contactEmail: "invited@example.test",
      contactPhone: "",
      preferredContactMethod: "email",
    },
    acknowledgements: {
      invitationConfirmed: true,
      accuracyConfirmed: true,
      rightsConfirmed: true,
      disclosureConfirmed: true,
      reviewProcessConfirmed: true,
    },
    rights: {
      authorityBasis: "original_author",
      authorityDetails: "",
      entitlementStatement: "I control the rights needed for review and publication.",
      publicSummary: "Original work created and controlled by the submitter.",
      publicNotes: "",
      privateNotes: "",
      containsThirdPartyMaterial: false,
      thirdPartyMaterialDetails: "",
      restrictions: "",
      territories: ["Worldwide"],
      distributorName: "Independent",
      distributorReleaseId: "ORBIT-001",
      isrc: "GBABC2600099",
      attestation: "I attest that this declaration is accurate.",
    },
    process: {
      aiUsed: true,
      aiUseDescription: "AI ideation informed arrangement sketches.",
      meaningfulHumanContribution: "Human composition, editing, and mix decisions.",
      toolsAndSystems: ["Sketcher"],
      humanRoles: [
        {
          name: "Invited Artist",
          role: "artist",
          contribution: "Composition and production",
          isPublic: true,
        },
      ],
      aiTools: [
        {
          name: "Sketcher",
          model: "v2",
          provider: "Example",
          purpose: "Ideation",
          isPublic: true,
        },
      ],
      lyricsUsed: false,
      lyricsDetails: "",
      voiceCloneUsed: false,
      voiceCloneDetails: "",
      samplesUsed: false,
      sampleDetails: "",
      sourceMaterialContext: "",
      publicSummary: "AI supported ideation while the artist directed the finished work.",
      privateNotes: "",
    },
    provenance: {
      summary: "Source sketches were reviewed and rebuilt by the artist.",
      publicNotes: "Evidence remains private.",
      privateNotes: "",
      steps: [
        {
          position: 1,
          processType: "arrangement",
          description: "The artist rebuilt the arrangement from sketches.",
          occurredAt: null,
        },
      ],
      sources: [
        {
          position: 1,
          sourceType: "generated_material",
          reference: "Sketch-001",
          rightsContext: "Internal ideation asset.",
        },
      ],
    },
    ...overrides,
  };
}

describe("submission service", () => {
  let repository: ReturnType<typeof createE2eSubmissionRepository>;
  let service: SubmissionService;
  const tokenHash = sha256Hex(e2eSubmissionInvitationToken);

  beforeEach(() => {
    repository = createE2eSubmissionRepository();
    service = new SubmissionService(
      repository,
      createTransactionalEmailService(undefined, "test"),
      () => new Date("2026-08-16T12:00:00Z"),
    );
  });

  it("saves drafts and submits invited work with a stable reference and lifecycle email log", async () => {
    const draft = completeDraft();

    const saved = await service.saveDraft(tokenHash, draft, {
      honeypotTriggered: false,
      userAgent: "vitest",
      ipHash: null,
    });
    expect(saved.ok).toBe(true);

    const submitted = await service.submit(tokenHash, draft, {
      honeypotTriggered: false,
      userAgent: "vitest",
      ipHash: null,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    expect(submitted.value.submission.publicReference).toBe("SUB-INV-E2E-001");
    expect(submitted.value.submission.status).toBe("received");
    expect(submitted.value.activities.some((activity) => activity.activityType === "email")).toBe(
      true,
    );
  });

  it("requires complete reviewed rights/process fields before acceptance", async () => {
    const draft = completeDraft({
      rights: {
        ...completeDraft().rights,
        authorityBasis: "other",
        territories: [],
      },
    });

    const submitted = await service.submit(tokenHash, draft, {
      honeypotTriggered: false,
      userAgent: "vitest",
      ipHash: null,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    await repository.transitionStatus({
      submissionId: submitted.value.submission.id,
      actor: { id: "curator-1", email: "curator@example.test" },
      toStatus: "eligibility_review",
      transitionedAt: new Date("2026-08-16T12:05:00Z"),
    });
    await repository.transitionStatus({
      submissionId: submitted.value.submission.id,
      actor: { id: "curator-1", email: "curator@example.test" },
      toStatus: "listening",
      transitionedAt: new Date("2026-08-16T12:06:00Z"),
    });

    const accepted = await service.accept({
      submissionId: submitted.value.submission.id,
      actor: { id: "curator-1", email: "curator@example.test" },
      acceptedAt: new Date("2026-08-16T12:07:00Z"),
      resultingTrackId: null,
      resultingReleaseId: null,
    });

    expect(accepted).toEqual({
      ok: false,
      error: {
        code: "invalid",
        message: "Accepted submissions cannot use “other” authority.",
      },
    });
  });

  it("records claim-specific clarification requests and retains submitter responses in history", async () => {
    const draft = completeDraft();
    const submitted = await service.submit(tokenHash, draft, {
      honeypotTriggered: false,
      userAgent: "vitest",
      ipHash: null,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const clarification = await service.requestClarification({
      submissionId: submitted.value.submission.id,
      actor: { id: "curator-1", email: "curator@example.test" },
      createdAt: new Date("2026-08-16T12:10:00Z"),
      claimKey: "rights.authorityBasis",
      message: "Please clarify the rights chain for this release.",
    });
    expect(clarification.ok).toBe(true);
    if (!clarification.ok) return;

    await repository.addClarificationResponse({
      submissionId: submitted.value.submission.id,
      actorEmail: "invited@example.test",
      createdAt: new Date("2026-08-16T12:11:00Z"),
      message: "The release is wholly original.",
    });

    const refreshed = await repository.findCuratorSubmission(submitted.value.submission.id);
    expect(refreshed?.submission.status).toBe("clarification_requested");
    expect(
      refreshed?.activities.filter(
        (activity) =>
          activity.activityType === "clarification_question" &&
          activity.claimKey === "rights.authorityBasis",
      ).length,
    ).toBe(1);
    expect(
      refreshed?.activities.some(
        (activity) =>
          activity.activityType === "clarification_response" &&
          activity.message === "The release is wholly original.",
      ),
    ).toBe(true);
  });
});
