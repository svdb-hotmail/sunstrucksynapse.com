import type {
  EvidenceAccessGrantRecord,
  EvidenceAccessRecord,
  EvidenceUploadSessionRecord,
  SubmissionAggregate,
  SubmissionDraftInput,
  SubmissionEvidenceRecord,
  SubmissionFilter,
  SubmissionInvitationRecord,
  SubmissionRepository,
} from "./submissions.server";
import { sha256Hex } from "~/services/submission-security.server";
import type {
  EvidenceMalwareStatus,
  SubmissionActivityType,
  SubmissionActorRole,
  SubmissionStatus,
} from "~/types/submissions";

export const e2eSubmissionInvitationToken = "phase3-invite-token";

function blankDraft(): SubmissionDraftInput {
  return {
    submissionKind: "track",
    workTitle: "",
    artist: {
      displayName: "",
      shortBiography: "",
      location: "",
      websiteUrl: "",
      socialUrl: "",
      priorWorkNotes: "",
    },
    release: {
      title: "",
      summary: "",
      plannedReleaseDate: "",
      labelName: "",
      distributorName: "",
      distributorReleaseId: "",
      territories: [],
    },
    track: {
      title: "",
      versionTitle: "",
      durationNotes: "",
      isLeadSingle: false,
      lyricsSummary: "",
      isInstrumental: false,
    },
    contact: {
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      preferredContactMethod: "email",
    },
    acknowledgements: {
      invitationConfirmed: false,
      accuracyConfirmed: false,
      rightsConfirmed: false,
      disclosureConfirmed: false,
      reviewProcessConfirmed: false,
    },
    rights: {
      authorityBasis: "original_author",
      authorityDetails: "",
      entitlementStatement: "",
      publicSummary: "",
      publicNotes: "",
      privateNotes: "",
      containsThirdPartyMaterial: false,
      thirdPartyMaterialDetails: "",
      restrictions: "",
      territories: [],
      distributorName: "",
      distributorReleaseId: "",
      isrc: "",
      attestation: "",
    },
    process: {
      aiUsed: true,
      aiUseDescription: "",
      meaningfulHumanContribution: "",
      toolsAndSystems: [],
      humanRoles: [],
      aiTools: [],
      lyricsUsed: false,
      lyricsDetails: "",
      voiceCloneUsed: false,
      voiceCloneDetails: "",
      samplesUsed: false,
      sampleDetails: "",
      sourceMaterialContext: "",
      publicSummary: "",
      privateNotes: "",
    },
    provenance: {
      summary: "",
      publicNotes: "",
      privateNotes: "",
      steps: [],
      sources: [],
    },
  };
}

function createAggregate(
  invitation: SubmissionInvitationRecord,
  input: SubmissionDraftInput,
  status: SubmissionStatus = "draft",
  ids?: {
    submissionId: string;
    rightsId: string;
    processId: string;
    provenanceId: string;
  },
): SubmissionAggregate {
  const submissionId = ids?.submissionId ?? crypto.randomUUID();
  return {
    invitation,
    submission: {
      id: submissionId,
      invitationId: invitation.id,
      publicReference: `SUB-${invitation.publicReference}`,
      invitationReference: invitation.publicReference,
      submissionKind: input.submissionKind,
      submitterName: input.contact.contactName,
      submitterEmail: input.contact.contactEmail,
      title: input.workTitle,
      artistDetails: input.artist,
      releaseDetails: input.release,
      trackDetails: input.track,
      contactDetails: input.contact,
      acknowledgements: input.acknowledgements,
      status,
      submittedAt: status === "draft" ? null : new Date("2026-08-16T08:00:00Z"),
      reviewedAt: status === "accepted" ? new Date("2026-08-16T09:00:00Z") : null,
      acceptedAt: status === "accepted" ? new Date("2026-08-16T09:00:00Z") : null,
      rejectedAt: null,
      withdrawnAt: null,
      assignedCuratorId: null,
      assignedCuratorEmail: null,
      assignedAt: null,
      rejectionReason: null,
      resultingReleaseId: status === "accepted" ? "20000000-0000-4000-8000-000000000101" : null,
      resultingTrackId: null,
      acceptedRightsDeclarationId: status === "accepted" ? "rights-seed" : null,
      acceptedCreativeProcessDisclosureId: status === "accepted" ? "process-seed" : null,
      acceptedProvenanceRecordId: status === "accepted" ? "prov-seed" : null,
      reviewNotes: null,
    },
    rights: {
      id: ids?.rightsId ?? (status === "accepted" ? "rights-seed" : crypto.randomUUID()),
      version: 1,
      status: status === "accepted" ? "attested" : "draft",
      revisionAuthorRole: "submitter",
      revisionAuthorName: input.contact.contactName || invitation.inviteeName || "Invited Artist",
      revisionAuthorEmail: input.contact.contactEmail || invitation.inviteeEmail,
      revisionReason: status === "accepted" ? "Initial submission" : "Saved draft",
      ...input.rights,
    },
    process: {
      id: ids?.processId ?? (status === "accepted" ? "process-seed" : crypto.randomUUID()),
      version: 1,
      status: status === "accepted" ? "finalized" : "draft",
      revisionAuthorRole: "submitter",
      revisionAuthorName: input.contact.contactName || invitation.inviteeName || "Invited Artist",
      revisionAuthorEmail: input.contact.contactEmail || invitation.inviteeEmail,
      revisionReason: status === "accepted" ? "Initial submission" : "Saved draft",
      ...input.process,
    },
    provenance: {
      id: ids?.provenanceId ?? (status === "accepted" ? "prov-seed" : crypto.randomUUID()),
      version: 1,
      status: status === "accepted" ? "finalized" : "draft",
      revisionAuthorRole: "submitter",
      revisionAuthorName: input.contact.contactName || invitation.inviteeName || "Invited Artist",
      revisionAuthorEmail: input.contact.contactEmail || invitation.inviteeEmail,
      revisionReason: status === "accepted" ? "Initial submission" : "Saved draft",
      ...input.provenance,
    },
    evidence: [],
    activities: [],
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function pushActivity(
  aggregate: SubmissionAggregate,
  activityType: SubmissionActivityType,
  actorRole: SubmissionActorRole,
  createdAt: Date,
  data: Partial<SubmissionAggregate["activities"][number]> = {},
) {
  aggregate.activities.unshift({
    id: crypto.randomUUID(),
    activityType,
    actorRole,
    actorId: data.actorId ?? null,
    actorEmail: data.actorEmail ?? null,
    fromStatus: data.fromStatus ?? null,
    toStatus: data.toStatus ?? null,
    claimKey: data.claimKey ?? null,
    message: data.message ?? null,
    metadata: data.metadata ?? {},
    createdAt,
  });
}

export function createE2eSubmissionRepository(): SubmissionRepository {
  const invitations = new Map<string, SubmissionInvitationRecord>();
  const invitationIdsByHash = new Map<string, string>();
  const aggregates = new Map<string, SubmissionAggregate>();
  const sessions = new Map<string, EvidenceUploadSessionRecord>();
  const grants = new Map<
    string,
    EvidenceAccessGrantRecord & {
      tokenHash: string;
      objectKey: string;
      mimeType: string;
      filename: string;
    }
  >();

  const publicInvitation: SubmissionInvitationRecord = {
    id: "submission-invite-1",
    publicReference: "INV-E2E-001",
    inviteeName: "Invited Artist",
    inviteeEmail: "invited@example.test",
    expiresAt: new Date("2030-01-01T00:00:00Z"),
    revokedAt: null,
  };
  invitations.set(publicInvitation.id, publicInvitation);
  invitationIdsByHash.set(sha256Hex(e2eSubmissionInvitationToken), publicInvitation.id);

  const acceptedInvitation: SubmissionInvitationRecord = {
    id: "submission-invite-accepted",
    publicReference: "INV-SEED-001",
    inviteeName: "Sunstruck Synapse",
    inviteeEmail: "rights@sunstrucksynapse.com",
    expiresAt: new Date("2030-01-01T00:00:00Z"),
    revokedAt: null,
  };
  invitations.set(acceptedInvitation.id, acceptedInvitation);
  const accepted = createAggregate(
    acceptedInvitation,
    {
      ...blankDraft(),
      submissionKind: "release",
      workTitle: "Phase Zero Transmissions",
      artist: {
        displayName: "Sunstruck Synapse",
        shortBiography: "Human-directed transmissions.",
        location: "Earth",
        websiteUrl: "https://example.test",
        socialUrl: "",
        priorWorkNotes: "",
      },
      release: {
        title: "Phase Zero Transmissions",
        summary: "Seeded release disclosure.",
        plannedReleaseDate: "2026-01-15",
        labelName: "",
        distributorName: "Independent",
        distributorReleaseId: "SSR-PHASE-0",
        territories: ["Worldwide"],
      },
      track: {
        title: "Sunstruck Synapse (Revolution will be televised)",
        versionTitle: "",
        durationNotes: "",
        isLeadSingle: true,
        lyricsSummary: "",
        isInstrumental: false,
      },
      contact: {
        contactName: "Sunstruck Synapse",
        contactEmail: "rights@sunstrucksynapse.com",
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
        entitlementStatement: "We control the relevant rights.",
        publicSummary: "Original-author release accepted for review.",
        publicNotes: "Rights-cleared for Sunstruck Synapse Radio.",
        privateNotes: "Seed private note.",
        containsThirdPartyMaterial: false,
        thirdPartyMaterialDetails: "",
        restrictions: "",
        territories: ["Worldwide"],
        distributorName: "Independent",
        distributorReleaseId: "SSR-PHASE-0",
        isrc: "GBABC2600001",
        attestation: "We attest to the rights declaration.",
      },
      process: {
        aiUsed: true,
        aiUseDescription: "AI-assisted ideation.",
        meaningfulHumanContribution: "Human composition, editing, and final production.",
        toolsAndSystems: ["Fictional Sketch Model"],
        humanRoles: [
          {
            name: "Sunstruck Synapse",
            role: "artist",
            contribution: "Composition",
            isPublic: true,
          },
        ],
        aiTools: [
          {
            name: "Fictional Sketch Model",
            model: "v1",
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
        publicSummary: "AI supported ideation; humans made the final musical decisions.",
        privateNotes: "Seed private process note.",
      },
      provenance: {
        summary: "Reviewed provenance summary.",
        publicNotes: "Public notes exclude evidence object references.",
        privateNotes: "Seed private provenance note.",
        steps: [
          {
            position: 1,
            processType: "arrangement",
            description: "The artist rebuilt the arrangement from the sketch.",
            occurredAt: null,
          },
        ],
        sources: [
          {
            position: 1,
            sourceType: "generated_material",
            reference: "Seed sketch 001",
            rightsContext: "Internal development sketch.",
          },
        ],
      },
    },
    "accepted",
    {
      submissionId: "70000000-0000-4000-8000-000000000901",
      rightsId: "80000000-0000-4000-8000-000000000901",
      processId: "90000000-0000-4000-8000-000000000901",
      provenanceId: "a0000000-0000-4000-8000-000000000901",
    },
  );
  aggregates.set(accepted.submission.id, accepted);

  function findInvitation(tokenHash: string, now: Date) {
    const id = invitationIdsByHash.get(tokenHash);
    if (!id) return null;
    const invitation = invitations.get(id) ?? null;
    if (!invitation || invitation.revokedAt || invitation.expiresAt <= now) return null;
    return invitation;
  }

  function byInvitationId(invitationId: string) {
    return (
      [...aggregates.values()].find(
        (aggregate) => aggregate.submission.invitationId === invitationId,
      ) ?? null
    );
  }

  function findSubmission(submissionId: string) {
    return aggregates.get(submissionId) ?? null;
  }

  function saveOrCreate(invitation: SubmissionInvitationRecord, input: SubmissionDraftInput) {
    const existing = byInvitationId(invitation.id);
    if (!existing) {
      const created = createAggregate(invitation, input);
      aggregates.set(created.submission.id, created);
      return created;
    }
    existing.submission.submissionKind = input.submissionKind;
    existing.submission.submitterName = input.contact.contactName;
    existing.submission.submitterEmail = input.contact.contactEmail;
    existing.submission.title = input.workTitle;
    existing.submission.artistDetails = clone(input.artist);
    existing.submission.releaseDetails = clone(input.release);
    existing.submission.trackDetails = clone(input.track);
    existing.submission.contactDetails = clone(input.contact);
    existing.submission.acknowledgements = clone(input.acknowledgements);
    if (existing.rights.status !== "draft") {
      existing.rights = {
        ...clone(existing.rights),
        id: crypto.randomUUID(),
        version: existing.rights.version + 1,
        status: "draft",
      };
    }
    Object.assign(existing.rights, clone(input.rights), {
      revisionAuthorRole: "submitter",
      revisionAuthorName: input.contact.contactName,
      revisionAuthorEmail: input.contact.contactEmail,
      revisionReason:
        existing.submission.status === "clarification_requested"
          ? "Clarification revision"
          : "Saved draft",
    });
    if (existing.process.status !== "draft") {
      existing.process = {
        ...clone(existing.process),
        id: crypto.randomUUID(),
        version: existing.process.version + 1,
        status: "draft",
      };
    }
    Object.assign(existing.process, clone(input.process), {
      revisionAuthorRole: "submitter",
      revisionAuthorName: input.contact.contactName,
      revisionAuthorEmail: input.contact.contactEmail,
      revisionReason:
        existing.submission.status === "clarification_requested"
          ? "Clarification revision"
          : "Saved draft",
    });
    if (existing.provenance.status !== "draft") {
      existing.provenance = {
        ...clone(existing.provenance),
        id: crypto.randomUUID(),
        version: existing.provenance.version + 1,
        status: "draft",
      };
    }
    Object.assign(existing.provenance, clone(input.provenance), {
      revisionAuthorRole: "submitter",
      revisionAuthorName: input.contact.contactName,
      revisionAuthorEmail: input.contact.contactEmail,
      revisionReason:
        existing.submission.status === "clarification_requested"
          ? "Clarification revision"
          : "Saved draft",
    });
    return existing;
  }

  function filtered(filter?: SubmissionFilter) {
    return [...aggregates.values()].filter((aggregate) => {
      if (
        filter?.status &&
        filter.status !== "all" &&
        aggregate.submission.status !== filter.status
      ) {
        return false;
      }
      if (
        filter?.assignedTo &&
        filter.assignedTo !== "all" &&
        aggregate.submission.assignedCuratorEmail !== filter.assignedTo
      ) {
        return false;
      }
      return true;
    });
  }

  return {
    async findInvitationByTokenHash(tokenHash, _now) {
      const invitation = findInvitation(tokenHash, new Date("2026-08-16T00:00:00Z"));
      return invitation ? clone(invitation) : null;
    },
    async findByInvitationTokenHash(tokenHash, now) {
      const invitation = findInvitation(tokenHash, now);
      if (!invitation) return null;
      const value = byInvitationId(invitation.id);
      return value ? clone(value) : null;
    },
    async saveDraftByInvitationTokenHash(tokenHash, input, now) {
      const invitation = findInvitation(tokenHash, now);
      if (!invitation) return null;
      return clone(saveOrCreate(invitation, input));
    },
    async submitByInvitationTokenHash(tokenHash, input, now) {
      const invitation = findInvitation(tokenHash, now);
      if (!invitation) return null;
      const aggregate = saveOrCreate(invitation, input);
      aggregate.rights.status = "attested";
      aggregate.process.status = "finalized";
      aggregate.provenance.status = "finalized";
      if (aggregate.submission.status === "draft") {
        aggregate.submission.status = "received";
        aggregate.submission.submittedAt = now;
        pushActivity(aggregate, "status_change", "submitter", now, {
          fromStatus: "draft",
          toStatus: "received",
          actorEmail: aggregate.submission.submitterEmail,
        });
      } else {
        pushActivity(aggregate, "clarification_response", "submitter", now, {
          actorEmail: aggregate.submission.submitterEmail,
          message: "Clarification response submitted.",
        });
      }
      return clone(aggregate);
    },
    async withdrawByInvitationTokenHash(tokenHash, now, message) {
      const aggregate = await this.findByInvitationTokenHash(tokenHash, now);
      if (!aggregate) return null;
      const stored = findSubmission(aggregate.submission.id)!;
      const fromStatus = stored.submission.status;
      stored.submission.status = "withdrawn";
      stored.submission.withdrawnAt = now;
      pushActivity(stored, "status_change", "submitter", now, {
        fromStatus,
        toStatus: "withdrawn",
        actorEmail: stored.submission.submitterEmail,
      });
      if (message?.trim()) {
        pushActivity(stored, "note", "submitter", now, {
          actorEmail: stored.submission.submitterEmail,
          message: message.trim(),
        });
      }
      return clone(stored);
    },
    async listCuratorSubmissions(filter) {
      return filtered(filter).map(clone);
    },
    async findCuratorSubmission(submissionId) {
      const value = findSubmission(submissionId);
      return value ? clone(value) : null;
    },
    async assignCurator(input) {
      const stored = findSubmission(input.submissionId);
      if (!stored) return null;
      stored.submission.assignedCuratorId = input.curator.id;
      stored.submission.assignedCuratorEmail = input.curator.email;
      stored.submission.assignedAt = input.assignedAt;
      pushActivity(stored, "assignment", "curator", input.assignedAt, {
        actorId: input.curator.id,
        actorEmail: input.curator.email,
        message: `Assigned to ${input.curator.email}`,
      });
      return clone(stored);
    },
    async transitionStatus(input) {
      const stored = findSubmission(input.submissionId);
      if (!stored) return null;
      const fromStatus = stored.submission.status;
      stored.submission.status = input.toStatus;
      if (
        input.toStatus === "eligibility_review" ||
        input.toStatus === "listening" ||
        input.toStatus === "clarification_requested"
      ) {
        stored.submission.reviewedAt ??= input.transitionedAt;
      }
      if (input.toStatus === "withdrawn") {
        stored.submission.withdrawnAt = input.transitionedAt;
      }
      pushActivity(stored, "status_change", "curator", input.transitionedAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        fromStatus,
        toStatus: input.toStatus,
        claimKey: input.claimKey ?? null,
        message: input.note ?? null,
      });
      return clone(stored);
    },
    async acceptSubmission(input) {
      const stored = findSubmission(input.submissionId);
      if (!stored) return null;
      stored.submission.status = "accepted";
      stored.submission.reviewedAt ??= input.acceptedAt;
      stored.submission.acceptedAt = input.acceptedAt;
      stored.submission.resultingReleaseId =
        input.resultingReleaseId ?? stored.submission.resultingReleaseId;
      stored.submission.resultingTrackId = input.resultingTrackId ?? null;
      stored.submission.acceptedRightsDeclarationId = stored.rights.id;
      stored.submission.acceptedCreativeProcessDisclosureId = stored.process.id;
      stored.submission.acceptedProvenanceRecordId = stored.provenance.id;
      pushActivity(stored, "status_change", "curator", input.acceptedAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        fromStatus: "listening",
        toStatus: "accepted",
        message: input.note ?? null,
      });
      return clone(stored);
    },
    async rejectSubmission(input) {
      const stored = findSubmission(input.submissionId);
      if (!stored) return null;
      const fromStatus = stored.submission.status;
      stored.submission.status = "rejected";
      stored.submission.reviewedAt ??= input.rejectedAt;
      stored.submission.rejectedAt = input.rejectedAt;
      stored.submission.rejectionReason = input.reason;
      pushActivity(stored, "status_change", "curator", input.rejectedAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        fromStatus,
        toStatus: "rejected",
        message: input.reason,
      });
      return clone(stored);
    },
    async addNote(input) {
      const stored = findSubmission(input.submissionId);
      if (!stored) return null;
      pushActivity(stored, "note", "curator", input.createdAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        message: input.message,
      });
      return clone(stored);
    },
    async addClarification(input) {
      const stored = findSubmission(input.submissionId);
      if (!stored) return null;
      const fromStatus = stored.submission.status;
      stored.submission.status = "clarification_requested";
      stored.submission.reviewedAt ??= input.createdAt;
      pushActivity(stored, "status_change", "curator", input.createdAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        fromStatus,
        toStatus: "clarification_requested",
        claimKey: input.claimKey,
      });
      pushActivity(stored, "clarification_question", "curator", input.createdAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        claimKey: input.claimKey,
        message: input.message,
      });
      return clone(stored);
    },
    async addClarificationResponse(input) {
      const stored = findSubmission(input.submissionId);
      if (!stored) return null;
      pushActivity(stored, "clarification_response", "submitter", input.createdAt, {
        actorEmail: input.actorEmail,
        message: input.message,
      });
      return clone(stored);
    },
    async createEvidenceUploadSession(tokenHash, declaration, now) {
      const aggregate = await this.findByInvitationTokenHash(tokenHash, now);
      if (!aggregate || aggregate.provenance.status !== "draft") return null;
      const session: EvidenceUploadSessionRecord = {
        id: crypto.randomUUID(),
        submissionId: aggregate.submission.id,
        provenanceRecordId: aggregate.provenance.id,
        objectKey: `private/evidence/${aggregate.submission.publicReference}/${declaration.filename}`,
        originalFilename: declaration.filename,
        mimeType: declaration.mimeType,
        checksumSha256: declaration.checksumSha256,
        byteSize: declaration.byteSize,
        status: "pending",
        actorRole: "submitter",
        actorEmail: aggregate.submission.submitterEmail,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      };
      sessions.set(session.id, session);
      return clone(session);
    },
    async getEvidenceUploadSession(sessionId) {
      const value = sessions.get(sessionId);
      return value ? clone(value) : null;
    },
    async completeEvidenceUploadSession(sessionId, _now) {
      const session = sessions.get(sessionId);
      if (!session || session.status !== "pending") return null;
      session.status = "completed";
      const aggregate = findSubmission(session.submissionId)!;
      const evidence: SubmissionEvidenceRecord = {
        id: crypto.randomUUID(),
        originalFilename: session.originalFilename,
        mimeType: session.mimeType,
        byteSize: session.byteSize,
        malwareStatus: "pending_review",
        scheduledDeletionAt: null,
        deletedAt: null,
      };
      aggregate.evidence.push(evidence);
      return clone(evidence);
    },
    async failEvidenceUploadSession(sessionId, _now, _failureReason) {
      const session = sessions.get(sessionId);
      if (!session) return false;
      session.status = "failed";
      return true;
    },
    async cleanupExpiredEvidenceUploadSessions(now) {
      let count = 0;
      for (const session of sessions.values()) {
        if (session.status === "pending" && session.expiresAt <= now) {
          session.status = "abandoned";
          count += 1;
        }
      }
      return count;
    },
    async updateEvidenceMalwareStatus(evidenceId, actor, now, malwareStatus, note) {
      const aggregate = [...aggregates.values()].find((candidate) =>
        candidate.evidence.some((evidence) => evidence.id === evidenceId),
      );
      if (!aggregate) return null;
      const evidence = aggregate.evidence.find((candidate) => candidate.id === evidenceId)!;
      evidence.malwareStatus = malwareStatus as EvidenceMalwareStatus;
      evidence.scheduledDeletionAt =
        malwareStatus === "quarantined" || malwareStatus === "rejected" ? now : null;
      pushActivity(aggregate, "note", "curator", now, {
        actorId: actor.id,
        actorEmail: actor.email,
        message: note ?? `Evidence ${evidence.originalFilename} marked ${malwareStatus}.`,
      });
      return clone(aggregate);
    },
    async createEvidenceAccessGrant(evidenceId, actor, _now, expiresAt, tokenHash) {
      const aggregate = [...aggregates.values()].find((candidate) =>
        candidate.evidence.some((evidence) => evidence.id === evidenceId),
      );
      const evidence = aggregate?.evidence.find((candidate) => candidate.id === evidenceId);
      if (
        !aggregate ||
        !evidence ||
        (evidence.malwareStatus !== "pending_review" && evidence.malwareStatus !== "cleared")
      ) {
        return null;
      }
      const grant: EvidenceAccessGrantRecord & {
        tokenHash: string;
        objectKey: string;
        mimeType: string;
        filename: string;
      } = {
        id: crypto.randomUUID(),
        evidenceId,
        actorId: actor.id,
        actorEmail: actor.email,
        expiresAt,
        tokenHash,
        objectKey: `private/evidence/${aggregate.submission.publicReference}/${evidence.originalFilename}`,
        mimeType: evidence.mimeType,
        filename: evidence.originalFilename,
      };
      grants.set(grant.id, grant);
      pushActivity(aggregate, "evidence_access", "curator", _now, {
        actorId: actor.id,
        actorEmail: actor.email,
        message: `Grant created for ${evidence.originalFilename}`,
      });
      return clone(grant);
    },
    async consumeEvidenceAccessGrant(tokenHash, now) {
      const grant = [...grants.values()].find(
        (candidate) => candidate.tokenHash === tokenHash && candidate.expiresAt > now,
      );
      if (!grant) return null;
      return {
        evidenceId: grant.evidenceId,
        grantId: grant.id,
        objectKey: grant.objectKey,
        mimeType: grant.mimeType,
        originalFilename: grant.filename,
      } satisfies EvidenceAccessRecord;
    },
    async recordEmailActivity(submissionId, now, recipientEmail, templateKey) {
      const aggregate = findSubmission(submissionId);
      if (!aggregate) return;
      pushActivity(aggregate, "email", "system", now, {
        actorEmail: "system@sunstrucksynapse.com",
        message: `${templateKey} -> ${recipientEmail}`,
        metadata: { templateKey, recipientEmail },
      });
    },
  };
}
