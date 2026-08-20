import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import type { Database } from "~/db/client.server";
import {
  creativeProcessDisclosures,
  evidenceUploadSessions,
  provenanceEvidence,
  provenanceEvidenceAccessAudit,
  provenanceEvidenceAccessGrants,
  provenanceRecords,
  provenanceSources,
  provenanceSteps,
  rightsDeclarations,
  submissionActivities,
  submissionInvitations,
  submissions,
} from "~/db/schema";
import type { CuratorIdentity } from "~/types/curator";
import type {
  AiToolDisclosure,
  ArtistSubmissionDetails,
  ContactSubmissionDetails,
  EvidenceMalwareStatus,
  HumanRoleDisclosure,
  ReleaseSubmissionDetails,
  SubmissionAcknowledgements,
  SubmissionActivityType,
  SubmissionActorRole,
  SubmissionKind,
  SubmissionProvenanceSource,
  SubmissionProvenanceStep,
  SubmissionStatus,
  TrackSubmissionDetails,
} from "~/types/submissions";

export interface SubmissionRightsInput {
  authorityBasis: "original_author" | "licensed" | "public_domain" | "other";
  authorityDetails: string;
  entitlementStatement: string;
  publicSummary: string;
  publicNotes: string;
  privateNotes: string;
  containsThirdPartyMaterial: boolean;
  thirdPartyMaterialDetails: string;
  restrictions: string;
  territories: string[];
  distributorName: string;
  distributorReleaseId: string;
  isrc: string;
  attestation: string;
}

export interface SubmissionProcessInput {
  aiUsed: boolean;
  aiUseDescription: string;
  meaningfulHumanContribution: string;
  toolsAndSystems: string[];
  humanRoles: HumanRoleDisclosure[];
  aiTools: AiToolDisclosure[];
  lyricsUsed: boolean;
  lyricsDetails: string;
  voiceCloneUsed: boolean;
  voiceCloneDetails: string;
  samplesUsed: boolean;
  sampleDetails: string;
  sourceMaterialContext: string;
  publicSummary: string;
  privateNotes: string;
}

export interface SubmissionProvenanceInput {
  summary: string;
  publicNotes: string;
  privateNotes: string;
  steps: SubmissionProvenanceStep[];
  sources: SubmissionProvenanceSource[];
}

export interface SubmissionDraftInput {
  submissionKind: SubmissionKind;
  workTitle: string;
  artist: ArtistSubmissionDetails;
  release: ReleaseSubmissionDetails;
  track: TrackSubmissionDetails;
  contact: ContactSubmissionDetails;
  acknowledgements: SubmissionAcknowledgements;
  rights: SubmissionRightsInput;
  process: SubmissionProcessInput;
  provenance: SubmissionProvenanceInput;
}

export interface SubmissionFilter {
  status?: SubmissionStatus | "all";
  assignedTo?: string | "all";
}

export interface SubmissionInvitationRecord {
  id: string;
  publicReference: string;
  inviteeName: string | null;
  inviteeEmail: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SubmissionVersionRecord {
  id: string;
  version: number;
  status: string;
  revisionAuthorRole: SubmissionActorRole;
  revisionAuthorName: string;
  revisionAuthorEmail: string;
  revisionReason: string;
}

export interface SubmissionEvidenceRecord {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  malwareStatus: EvidenceMalwareStatus;
  scheduledDeletionAt: Date | null;
  deletedAt: Date | null;
}

export interface SubmissionActivityRecord {
  id: string;
  activityType: SubmissionActivityType;
  actorRole: SubmissionActorRole;
  actorId: string | null;
  actorEmail: string | null;
  fromStatus: SubmissionStatus | null;
  toStatus: SubmissionStatus | null;
  claimKey: string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SubmissionRecord {
  id: string;
  invitationId: string;
  publicReference: string;
  invitationReference: string;
  submissionKind: SubmissionKind;
  submitterName: string;
  submitterEmail: string;
  title: string;
  artistDetails: ArtistSubmissionDetails;
  releaseDetails: ReleaseSubmissionDetails;
  trackDetails: TrackSubmissionDetails;
  contactDetails: ContactSubmissionDetails;
  acknowledgements: SubmissionAcknowledgements;
  status: SubmissionStatus;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  withdrawnAt: Date | null;
  assignedCuratorId: string | null;
  assignedCuratorEmail: string | null;
  assignedAt: Date | null;
  rejectionReason: string | null;
  resultingReleaseId: string | null;
  resultingTrackId: string | null;
  acceptedRightsDeclarationId: string | null;
  acceptedCreativeProcessDisclosureId: string | null;
  acceptedProvenanceRecordId: string | null;
  reviewNotes: string | null;
}

export interface SubmissionAggregate {
  invitation: SubmissionInvitationRecord;
  submission: SubmissionRecord;
  rights: SubmissionVersionRecord & SubmissionRightsInput;
  process: SubmissionVersionRecord & SubmissionProcessInput;
  provenance: SubmissionVersionRecord & SubmissionProvenanceInput;
  evidence: SubmissionEvidenceRecord[];
  activities: SubmissionActivityRecord[];
}

export interface SubmissionAssignmentInput {
  submissionId: string;
  curator: CuratorIdentity;
  assignedAt: Date;
}

export interface SubmissionStatusTransitionInput {
  submissionId: string;
  actor: CuratorIdentity;
  toStatus: SubmissionStatus;
  transitionedAt: Date;
  note?: string | null;
  claimKey?: string | null;
}

export interface SubmissionAcceptInput {
  submissionId: string;
  actor: CuratorIdentity;
  acceptedAt: Date;
  note?: string | null;
  resultingReleaseId?: string | null;
  resultingTrackId?: string | null;
}

export interface SubmissionRejectInput {
  submissionId: string;
  actor: CuratorIdentity;
  rejectedAt: Date;
  reason: string;
}

export interface SubmissionNoteInput {
  submissionId: string;
  actor: CuratorIdentity;
  createdAt: Date;
  message: string;
}

export interface SubmissionClarificationInput {
  submissionId: string;
  actor: CuratorIdentity;
  createdAt: Date;
  claimKey: string;
  message: string;
}

export interface SubmissionResponseInput {
  submissionId: string;
  actorEmail: string;
  createdAt: Date;
  message: string;
}

export interface EvidenceUploadSessionRecord {
  id: string;
  submissionId: string;
  provenanceRecordId: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  checksumSha256: string;
  byteSize: number;
  status: "pending" | "completed" | "abandoned" | "failed";
  actorRole: SubmissionActorRole;
  actorEmail: string | null;
  expiresAt: Date;
}

export interface EvidenceUploadDeclaration {
  filename: string;
  mimeType: string;
  checksumSha256: string;
  byteSize: number;
}

export interface EvidenceAccessGrantRecord {
  id: string;
  evidenceId: string;
  actorId: string;
  actorEmail: string;
  expiresAt: Date;
}

export interface EvidenceAccessRecord {
  evidenceId: string;
  grantId: string;
  objectKey: string;
  mimeType: string;
  originalFilename: string;
}

export interface SubmissionRepository {
  findInvitationByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<SubmissionInvitationRecord | null>;
  findByInvitationTokenHash(tokenHash: string, now: Date): Promise<SubmissionAggregate | null>;
  saveDraftByInvitationTokenHash(
    tokenHash: string,
    input: SubmissionDraftInput,
    now: Date,
    abuseSignals: { honeypotTriggered: boolean; userAgent: string | null; ipHash: string | null },
    revisionReason: string,
  ): Promise<SubmissionAggregate | null>;
  submitByInvitationTokenHash(
    tokenHash: string,
    input: SubmissionDraftInput,
    now: Date,
    abuseSignals: { honeypotTriggered: boolean; userAgent: string | null; ipHash: string | null },
    revisionReason: string,
  ): Promise<SubmissionAggregate | null>;
  withdrawByInvitationTokenHash(
    tokenHash: string,
    now: Date,
    message: string | null,
  ): Promise<SubmissionAggregate | null>;
  listCuratorSubmissions(filter?: SubmissionFilter): Promise<SubmissionAggregate[]>;
  findCuratorSubmission(submissionId: string): Promise<SubmissionAggregate | null>;
  assignCurator(input: SubmissionAssignmentInput): Promise<SubmissionAggregate | null>;
  transitionStatus(input: SubmissionStatusTransitionInput): Promise<SubmissionAggregate | null>;
  acceptSubmission(input: SubmissionAcceptInput): Promise<SubmissionAggregate | null>;
  rejectSubmission(input: SubmissionRejectInput): Promise<SubmissionAggregate | null>;
  addNote(input: SubmissionNoteInput): Promise<SubmissionAggregate | null>;
  addClarification(input: SubmissionClarificationInput): Promise<SubmissionAggregate | null>;
  addClarificationResponse(input: SubmissionResponseInput): Promise<SubmissionAggregate | null>;
  createEvidenceUploadSession(
    tokenHash: string,
    declaration: EvidenceUploadDeclaration,
    now: Date,
  ): Promise<EvidenceUploadSessionRecord | null>;
  getEvidenceUploadSession(sessionId: string): Promise<EvidenceUploadSessionRecord | null>;
  completeEvidenceUploadSession(
    sessionId: string,
    now: Date,
  ): Promise<SubmissionEvidenceRecord | null>;
  failEvidenceUploadSession(sessionId: string, now: Date, failureReason: string): Promise<boolean>;
  cleanupExpiredEvidenceUploadSessions(now: Date): Promise<number>;
  updateEvidenceMalwareStatus(
    evidenceId: string,
    actor: CuratorIdentity,
    now: Date,
    malwareStatus: EvidenceMalwareStatus,
    note?: string | null,
  ): Promise<SubmissionAggregate | null>;
  createEvidenceAccessGrant(
    evidenceId: string,
    actor: CuratorIdentity,
    now: Date,
    expiresAt: Date,
    tokenHash: string,
  ): Promise<EvidenceAccessGrantRecord | null>;
  consumeEvidenceAccessGrant(tokenHash: string, now: Date): Promise<EvidenceAccessRecord | null>;
  recordEmailActivity(
    submissionId: string,
    now: Date,
    recipientEmail: string,
    templateKey: string,
  ): Promise<void>;
}

function sanitizeString(value: string): string {
  return value.trim();
}

function sanitizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function sanitizeHumanRoles(values: HumanRoleDisclosure[]): HumanRoleDisclosure[] {
  return values
    .map((value) => ({
      name: sanitizeString(value.name),
      role: sanitizeString(value.role),
      contribution: sanitizeString(value.contribution),
      isPublic: Boolean(value.isPublic),
    }))
    .filter((value) => value.name || value.role || value.contribution);
}

function sanitizeAiTools(values: AiToolDisclosure[]): AiToolDisclosure[] {
  return values
    .map((value) => ({
      name: sanitizeString(value.name),
      model: sanitizeString(value.model),
      provider: sanitizeString(value.provider),
      purpose: sanitizeString(value.purpose),
      isPublic: Boolean(value.isPublic),
    }))
    .filter((value) => value.name || value.model || value.provider || value.purpose);
}

function sanitizeSteps(values: SubmissionProvenanceStep[]): SubmissionProvenanceStep[] {
  return values
    .map((value, index) => ({
      position: index + 1,
      processType: sanitizeString(value.processType),
      description: sanitizeString(value.description),
      occurredAt: value.occurredAt ? sanitizeString(value.occurredAt) : null,
    }))
    .filter((value) => value.processType || value.description);
}

function sanitizeSources(values: SubmissionProvenanceSource[]): SubmissionProvenanceSource[] {
  return values
    .map((value, index) => ({
      position: index + 1,
      sourceType: value.sourceType,
      reference: sanitizeString(value.reference),
      rightsContext: value.rightsContext ? sanitizeString(value.rightsContext) : null,
    }))
    .filter((value) => value.reference);
}

function sanitizeDraftInput(input: SubmissionDraftInput): SubmissionDraftInput {
  return {
    submissionKind: input.submissionKind,
    workTitle: sanitizeString(input.workTitle),
    artist: {
      displayName: sanitizeString(input.artist.displayName),
      shortBiography: sanitizeString(input.artist.shortBiography),
      location: sanitizeString(input.artist.location),
      websiteUrl: sanitizeString(input.artist.websiteUrl),
      socialUrl: sanitizeString(input.artist.socialUrl),
      priorWorkNotes: sanitizeString(input.artist.priorWorkNotes),
    },
    release: {
      title: sanitizeString(input.release.title),
      summary: sanitizeString(input.release.summary),
      plannedReleaseDate: sanitizeString(input.release.plannedReleaseDate),
      labelName: sanitizeString(input.release.labelName),
      distributorName: sanitizeString(input.release.distributorName),
      distributorReleaseId: sanitizeString(input.release.distributorReleaseId),
      territories: sanitizeStringList(input.release.territories),
    },
    track: {
      title: sanitizeString(input.track.title),
      versionTitle: sanitizeString(input.track.versionTitle),
      durationNotes: sanitizeString(input.track.durationNotes),
      isLeadSingle: Boolean(input.track.isLeadSingle),
      lyricsSummary: sanitizeString(input.track.lyricsSummary),
      isInstrumental: Boolean(input.track.isInstrumental),
    },
    contact: {
      contactName: sanitizeString(input.contact.contactName),
      contactEmail: sanitizeString(input.contact.contactEmail).toLowerCase(),
      contactPhone: sanitizeString(input.contact.contactPhone),
      preferredContactMethod: input.contact.preferredContactMethod,
    },
    acknowledgements: {
      invitationConfirmed: Boolean(input.acknowledgements.invitationConfirmed),
      accuracyConfirmed: Boolean(input.acknowledgements.accuracyConfirmed),
      rightsConfirmed: Boolean(input.acknowledgements.rightsConfirmed),
      disclosureConfirmed: Boolean(input.acknowledgements.disclosureConfirmed),
      reviewProcessConfirmed: Boolean(input.acknowledgements.reviewProcessConfirmed),
    },
    rights: {
      authorityBasis: input.rights.authorityBasis,
      authorityDetails: sanitizeString(input.rights.authorityDetails),
      entitlementStatement: sanitizeString(input.rights.entitlementStatement),
      publicSummary: sanitizeString(input.rights.publicSummary),
      publicNotes: sanitizeString(input.rights.publicNotes),
      privateNotes: sanitizeString(input.rights.privateNotes),
      containsThirdPartyMaterial: Boolean(input.rights.containsThirdPartyMaterial),
      thirdPartyMaterialDetails: sanitizeString(input.rights.thirdPartyMaterialDetails),
      restrictions: sanitizeString(input.rights.restrictions),
      territories: sanitizeStringList(input.rights.territories),
      distributorName: sanitizeString(input.rights.distributorName),
      distributorReleaseId: sanitizeString(input.rights.distributorReleaseId),
      isrc: sanitizeString(input.rights.isrc).toUpperCase(),
      attestation: sanitizeString(input.rights.attestation),
    },
    process: {
      aiUsed: Boolean(input.process.aiUsed),
      aiUseDescription: sanitizeString(input.process.aiUseDescription),
      meaningfulHumanContribution: sanitizeString(input.process.meaningfulHumanContribution),
      toolsAndSystems: sanitizeStringList(input.process.toolsAndSystems),
      humanRoles: sanitizeHumanRoles(input.process.humanRoles),
      aiTools: sanitizeAiTools(input.process.aiTools),
      lyricsUsed: Boolean(input.process.lyricsUsed),
      lyricsDetails: sanitizeString(input.process.lyricsDetails),
      voiceCloneUsed: Boolean(input.process.voiceCloneUsed),
      voiceCloneDetails: sanitizeString(input.process.voiceCloneDetails),
      samplesUsed: Boolean(input.process.samplesUsed),
      sampleDetails: sanitizeString(input.process.sampleDetails),
      sourceMaterialContext: sanitizeString(input.process.sourceMaterialContext),
      publicSummary: sanitizeString(input.process.publicSummary),
      privateNotes: sanitizeString(input.process.privateNotes),
    },
    provenance: {
      summary: sanitizeString(input.provenance.summary),
      publicNotes: sanitizeString(input.provenance.publicNotes),
      privateNotes: sanitizeString(input.provenance.privateNotes),
      steps: sanitizeSteps(input.provenance.steps),
      sources: sanitizeSources(input.provenance.sources),
    },
  };
}

function emptyMetadata(): Record<string, unknown> {
  return {};
}

function mapSubmission(row: typeof submissions.$inferSelect): SubmissionRecord {
  return {
    id: row.id,
    invitationId: row.invitationId,
    publicReference: row.publicReference,
    invitationReference: row.invitationReference,
    submissionKind: row.submissionKind,
    submitterName: row.submitterName,
    submitterEmail: row.submitterEmail,
    title: row.title,
    artistDetails: row.artistDetails,
    releaseDetails: row.releaseDetails,
    trackDetails: row.trackDetails,
    contactDetails: row.contactDetails,
    acknowledgements: row.acknowledgements,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    acceptedAt: row.acceptedAt,
    rejectedAt: row.rejectedAt,
    withdrawnAt: row.withdrawnAt,
    assignedCuratorId: row.assignedCuratorId,
    assignedCuratorEmail: row.assignedCuratorEmail,
    assignedAt: row.assignedAt,
    rejectionReason: row.rejectionReason,
    resultingReleaseId: row.resultingReleaseId,
    resultingTrackId: row.resultingTrackId,
    acceptedRightsDeclarationId: row.acceptedRightsDeclarationId,
    acceptedCreativeProcessDisclosureId: row.acceptedCreativeProcessDisclosureId,
    acceptedProvenanceRecordId: row.acceptedProvenanceRecordId,
    reviewNotes: row.reviewNotes,
  };
}

function mapInvitation(row: typeof submissionInvitations.$inferSelect): SubmissionInvitationRecord {
  return {
    id: row.id,
    publicReference: row.publicReference,
    inviteeName: row.inviteeName,
    inviteeEmail: row.inviteeEmail,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

function mapEvidence(row: typeof provenanceEvidence.$inferSelect): SubmissionEvidenceRecord {
  return {
    id: row.id,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    malwareStatus: row.malwareStatus,
    scheduledDeletionAt: row.scheduledDeletionAt,
    deletedAt: row.deletedAt,
  };
}

function mapActivity(row: typeof submissionActivities.$inferSelect): SubmissionActivityRecord {
  return {
    id: row.id,
    activityType: row.activityType,
    actorRole: row.actorRole,
    actorId: row.actorId,
    actorEmail: row.actorEmail,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    claimKey: row.claimKey,
    message: row.message,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt,
  };
}

export function createSubmissionRepository(db: Database): SubmissionRepository {
  async function loadLatestRightsVersion(submissionId: string) {
    const [row] = await db
      .select()
      .from(rightsDeclarations)
      .where(eq(rightsDeclarations.submissionId, submissionId))
      .orderBy(desc(rightsDeclarations.version))
      .limit(1);
    return row ?? null;
  }

  async function loadLatestProcessVersion(submissionId: string) {
    const [row] = await db
      .select()
      .from(creativeProcessDisclosures)
      .where(eq(creativeProcessDisclosures.submissionId, submissionId))
      .orderBy(desc(creativeProcessDisclosures.version))
      .limit(1);
    return row ?? null;
  }

  async function loadLatestProvenanceVersion(submissionId: string) {
    const [row] = await db
      .select()
      .from(provenanceRecords)
      .where(eq(provenanceRecords.submissionId, submissionId))
      .orderBy(desc(provenanceRecords.version))
      .limit(1);
    return row ?? null;
  }

  async function loadSubmissionActivities(
    submissionId: string,
  ): Promise<SubmissionActivityRecord[]> {
    const rows = await db
      .select()
      .from(submissionActivities)
      .where(eq(submissionActivities.submissionId, submissionId))
      .orderBy(desc(submissionActivities.createdAt), desc(submissionActivities.id));
    return rows.map(mapActivity);
  }

  async function loadEvidenceForProvenance(
    provenanceRecordId: string,
  ): Promise<SubmissionEvidenceRecord[]> {
    const rows = await db
      .select()
      .from(provenanceEvidence)
      .where(eq(provenanceEvidence.provenanceRecordId, provenanceRecordId))
      .orderBy(asc(provenanceEvidence.createdAt), asc(provenanceEvidence.id));
    return rows.map(mapEvidence);
  }

  async function loadProvenanceSteps(recordId: string): Promise<SubmissionProvenanceStep[]> {
    const rows = await db
      .select()
      .from(provenanceSteps)
      .where(eq(provenanceSteps.provenanceRecordId, recordId))
      .orderBy(asc(provenanceSteps.position), asc(provenanceSteps.id));
    return rows.map((row) => ({
      position: row.position,
      processType: row.processType,
      description: row.description,
      occurredAt: row.occurredAt ? row.occurredAt.toISOString() : null,
    }));
  }

  async function loadProvenanceSources(recordId: string): Promise<SubmissionProvenanceSource[]> {
    const rows = await db
      .select()
      .from(provenanceSources)
      .where(eq(provenanceSources.provenanceRecordId, recordId))
      .orderBy(asc(provenanceSources.position), asc(provenanceSources.id));
    return rows.map((row) => ({
      position: row.position,
      sourceType: row.sourceType,
      reference: row.reference,
      rightsContext: row.rightsContext,
    }));
  }

  async function buildAggregate(submissionId: string): Promise<SubmissionAggregate | null> {
    const [submissionRow] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);
    if (!submissionRow) return null;
    const submission = mapSubmission(submissionRow);
    const [invitationRow, rightsRow, processRow, provenanceRow] = await Promise.all([
      db
        .select()
        .from(submissionInvitations)
        .where(eq(submissionInvitations.id, submission.invitationId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      loadLatestRightsVersion(submissionId),
      loadLatestProcessVersion(submissionId),
      loadLatestProvenanceVersion(submissionId),
    ]);
    if (!invitationRow || !rightsRow || !processRow || !provenanceRow) return null;
    const [steps, sources, evidence, activities] = await Promise.all([
      loadProvenanceSteps(provenanceRow.id),
      loadProvenanceSources(provenanceRow.id),
      loadEvidenceForProvenance(provenanceRow.id),
      loadSubmissionActivities(submissionId),
    ]);
    return {
      invitation: mapInvitation(invitationRow),
      submission,
      rights: {
        id: rightsRow.id,
        version: rightsRow.version,
        status: rightsRow.status,
        revisionAuthorRole: rightsRow.revisionAuthorRole,
        revisionAuthorName: rightsRow.revisionAuthorName,
        revisionAuthorEmail: rightsRow.revisionAuthorEmail,
        revisionReason: rightsRow.revisionReason,
        authorityBasis: rightsRow.authorityBasis,
        authorityDetails: rightsRow.authorityDetails ?? "",
        entitlementStatement: rightsRow.entitlementStatement,
        publicSummary: rightsRow.publicSummary,
        publicNotes: rightsRow.publicNotes ?? "",
        privateNotes: rightsRow.privateNotes ?? "",
        containsThirdPartyMaterial: rightsRow.containsThirdPartyMaterial,
        thirdPartyMaterialDetails: rightsRow.thirdPartyMaterialDetails ?? "",
        restrictions: rightsRow.restrictions ?? "",
        territories: rightsRow.territories,
        distributorName: rightsRow.distributorName ?? "",
        distributorReleaseId: rightsRow.distributorReleaseId ?? "",
        isrc: rightsRow.isrc ?? "",
        attestation: rightsRow.attestation ?? "",
      },
      process: {
        id: processRow.id,
        version: processRow.version,
        status: processRow.status,
        revisionAuthorRole: processRow.revisionAuthorRole,
        revisionAuthorName: processRow.revisionAuthorName,
        revisionAuthorEmail: processRow.revisionAuthorEmail,
        revisionReason: processRow.revisionReason,
        aiUsed: processRow.aiUsed,
        aiUseDescription: processRow.aiUseDescription ?? "",
        meaningfulHumanContribution: processRow.meaningfulHumanContribution,
        toolsAndSystems: processRow.toolsAndSystems,
        humanRoles: processRow.humanRoles,
        aiTools: processRow.aiTools,
        lyricsUsed: processRow.lyricsUsed,
        lyricsDetails: processRow.lyricsDetails ?? "",
        voiceCloneUsed: processRow.voiceCloneUsed,
        voiceCloneDetails: processRow.voiceCloneDetails ?? "",
        samplesUsed: processRow.samplesUsed,
        sampleDetails: processRow.sampleDetails ?? "",
        sourceMaterialContext: processRow.sourceMaterialContext ?? "",
        publicSummary: processRow.artistSummary,
        privateNotes: processRow.privateNotes ?? "",
      },
      provenance: {
        id: provenanceRow.id,
        version: provenanceRow.version,
        status: provenanceRow.status,
        revisionAuthorRole: provenanceRow.revisionAuthorRole,
        revisionAuthorName: provenanceRow.revisionAuthorName,
        revisionAuthorEmail: provenanceRow.revisionAuthorEmail,
        revisionReason: provenanceRow.revisionReason,
        summary: provenanceRow.summary,
        publicNotes: provenanceRow.publicNotes ?? "",
        privateNotes: provenanceRow.privateNotes ?? "",
        steps,
        sources,
      },
      evidence,
      activities,
    };
  }

  async function loadValidInvitationByHash(tokenHash: string, now: Date) {
    const [row] = await db
      .select()
      .from(submissionInvitations)
      .where(
        and(
          eq(submissionInvitations.tokenHash, tokenHash),
          isNull(submissionInvitations.revokedAt),
          sql`${submissionInvitations.expiresAt} > ${now}`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async function loadSubmissionByInvitationId(invitationId: string) {
    const [row] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.invitationId, invitationId))
      .limit(1);
    return row ?? null;
  }

  async function touchInvitation(invitationId: string, openedAt: Date) {
    await db
      .update(submissionInvitations)
      .set({ lastOpenedAt: openedAt, updatedAt: openedAt })
      .where(eq(submissionInvitations.id, invitationId));
  }

  async function createSubmissionFromInvitation(
    invitation: typeof submissionInvitations.$inferSelect,
    input: SubmissionDraftInput,
    now: Date,
    abuseSignals: { honeypotTriggered: boolean; userAgent: string | null; ipHash: string | null },
  ) {
    const [row] = await db
      .insert(submissions)
      .values({
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
        abuseSignals: {
          honeypotTriggered: abuseSignals.honeypotTriggered,
          saveCount: 0,
          submitCount: 0,
          lastUserAgent: abuseSignals.userAgent,
          lastIpHash: abuseSignals.ipHash,
        },
      })
      .returning();
    return row;
  }

  async function upsertRightsDraft(
    submissionId: string,
    input: SubmissionDraftInput,
    now: Date,
    revisionReason: string,
  ) {
    const latest = await loadLatestRightsVersion(submissionId);
    const values = {
      revisionAuthorRole: "submitter" as const,
      revisionAuthorName: input.contact.contactName,
      revisionAuthorEmail: input.contact.contactEmail,
      revisionReason,
      authorityBasis: input.rights.authorityBasis,
      authorityDetails: input.rights.authorityDetails || null,
      entitlementStatement: input.rights.entitlementStatement,
      publicSummary: input.rights.publicSummary,
      publicNotes: input.rights.publicNotes || null,
      privateNotes: input.rights.privateNotes || null,
      containsThirdPartyMaterial: input.rights.containsThirdPartyMaterial,
      thirdPartyMaterialDetails: input.rights.thirdPartyMaterialDetails || null,
      restrictions: input.rights.restrictions || null,
      territories: input.rights.territories,
      distributorName: input.rights.distributorName || null,
      distributorReleaseId: input.rights.distributorReleaseId || null,
      isrc: input.rights.isrc || null,
      updatedAt: now,
    };
    if (!latest) {
      const [created] = await db
        .insert(rightsDeclarations)
        .values({
          submissionId,
          version: 1,
          status: "draft",
          attestation: null,
          attestedAt: null,
          ...values,
        })
        .returning();
      return created;
    }
    if (latest.status === "draft") {
      const [updated] = await db
        .update(rightsDeclarations)
        .set({ ...values, attestation: input.rights.attestation || null })
        .where(eq(rightsDeclarations.id, latest.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(rightsDeclarations)
      .values({
        submissionId,
        version: latest.version + 1,
        supersedesId: latest.id,
        status: "draft",
        attestation: null,
        attestedAt: null,
        ...values,
      })
      .returning();
    return created;
  }

  async function upsertProcessDraft(
    submissionId: string,
    input: SubmissionDraftInput,
    now: Date,
    revisionReason: string,
  ) {
    const latest = await loadLatestProcessVersion(submissionId);
    const values = {
      revisionAuthorRole: "submitter" as const,
      revisionAuthorName: input.contact.contactName,
      revisionAuthorEmail: input.contact.contactEmail,
      revisionReason,
      aiUsed: input.process.aiUsed,
      aiUseDescription: input.process.aiUseDescription || null,
      meaningfulHumanContribution: input.process.meaningfulHumanContribution,
      toolsAndSystems: input.process.toolsAndSystems,
      humanRoles: input.process.humanRoles,
      aiTools: input.process.aiTools,
      lyricsUsed: input.process.lyricsUsed,
      lyricsDetails: input.process.lyricsDetails || null,
      voiceCloneUsed: input.process.voiceCloneUsed,
      voiceCloneDetails: input.process.voiceCloneDetails || null,
      samplesUsed: input.process.samplesUsed,
      sampleDetails: input.process.sampleDetails || null,
      sourceMaterialContext: input.process.sourceMaterialContext || null,
      artistSummary: input.process.publicSummary,
      privateNotes: input.process.privateNotes || null,
      updatedAt: now,
    };
    if (!latest) {
      const [created] = await db
        .insert(creativeProcessDisclosures)
        .values({
          submissionId,
          version: 1,
          status: "draft",
          finalizedAt: null,
          ...values,
        })
        .returning();
      return created;
    }
    if (latest.status === "draft") {
      const [updated] = await db
        .update(creativeProcessDisclosures)
        .set(values)
        .where(eq(creativeProcessDisclosures.id, latest.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(creativeProcessDisclosures)
      .values({
        submissionId,
        version: latest.version + 1,
        supersedesId: latest.id,
        status: "draft",
        finalizedAt: null,
        ...values,
      })
      .returning();
    return created;
  }

  async function replaceProvenanceDetails(recordId: string, input: SubmissionProvenanceInput) {
    await db.delete(provenanceSteps).where(eq(provenanceSteps.provenanceRecordId, recordId));
    await db.delete(provenanceSources).where(eq(provenanceSources.provenanceRecordId, recordId));
    if (input.steps.length > 0) {
      await db.insert(provenanceSteps).values(
        input.steps.map((step) => ({
          provenanceRecordId: recordId,
          position: step.position,
          processType: step.processType,
          description: step.description,
          occurredAt: step.occurredAt ? new Date(step.occurredAt) : null,
        })),
      );
    }
    if (input.sources.length > 0) {
      await db.insert(provenanceSources).values(
        input.sources.map((source) => ({
          provenanceRecordId: recordId,
          position: source.position,
          sourceType: source.sourceType,
          reference: source.reference,
          rightsContext: source.rightsContext,
        })),
      );
    }
  }

  async function copyProvenanceEvidence(sourceRecordId: string, targetRecordId: string) {
    const evidenceRows = await db
      .select()
      .from(provenanceEvidence)
      .where(eq(provenanceEvidence.provenanceRecordId, sourceRecordId));
    if (evidenceRows.length === 0) return;
    await db.insert(provenanceEvidence).values(
      evidenceRows.map((row) => ({
        provenanceRecordId: targetRecordId,
        storageProvider: row.storageProvider,
        objectKey: row.objectKey,
        originalFilename: row.originalFilename,
        mimeType: row.mimeType,
        checksumSha256: row.checksumSha256,
        byteSize: row.byteSize,
        malwareStatus: row.malwareStatus,
        scheduledDeletionAt: row.scheduledDeletionAt,
        deletedAt: row.deletedAt,
      })),
    );
  }

  async function upsertProvenanceDraft(
    submissionId: string,
    input: SubmissionDraftInput,
    now: Date,
    revisionReason: string,
  ) {
    const latest = await loadLatestProvenanceVersion(submissionId);
    const values = {
      revisionAuthorRole: "submitter" as const,
      revisionAuthorName: input.contact.contactName,
      revisionAuthorEmail: input.contact.contactEmail,
      revisionReason,
      summary: input.provenance.summary,
      publicNotes: input.provenance.publicNotes || null,
      privateNotes: input.provenance.privateNotes || null,
      updatedAt: now,
    };
    if (!latest) {
      const [created] = await db
        .insert(provenanceRecords)
        .values({
          submissionId,
          version: 1,
          status: "draft",
          finalizedAt: null,
          ...values,
        })
        .returning();
      await replaceProvenanceDetails(created.id, input.provenance);
      return created;
    }
    if (latest.status === "draft") {
      const [updated] = await db
        .update(provenanceRecords)
        .set(values)
        .where(eq(provenanceRecords.id, latest.id))
        .returning();
      await replaceProvenanceDetails(updated.id, input.provenance);
      return updated;
    }
    const [created] = await db
      .insert(provenanceRecords)
      .values({
        submissionId,
        version: latest.version + 1,
        supersedesId: latest.id,
        status: "draft",
        finalizedAt: null,
        ...values,
      })
      .returning();
    await replaceProvenanceDetails(created.id, input.provenance);
    await copyProvenanceEvidence(latest.id, created.id);
    return created;
  }

  async function upsertSubmissionDraft(
    invitation: typeof submissionInvitations.$inferSelect,
    input: SubmissionDraftInput,
    now: Date,
    abuseSignals: { honeypotTriggered: boolean; userAgent: string | null; ipHash: string | null },
    revisionReason: string,
  ) {
    const existing = await loadSubmissionByInvitationId(invitation.id);
    const currentSubmission =
      existing ?? (await createSubmissionFromInvitation(invitation, input, now, abuseSignals));
    const previousSignals = existing?.abuseSignals ?? {
      honeypotTriggered: false,
      saveCount: 0,
      submitCount: 0,
      lastUserAgent: null,
      lastIpHash: null,
    };
    await db
      .update(submissions)
      .set({
        submissionKind: input.submissionKind,
        submitterName: input.contact.contactName,
        submitterEmail: input.contact.contactEmail,
        title: input.workTitle,
        artistDetails: input.artist,
        releaseDetails: input.release,
        trackDetails: input.track,
        contactDetails: input.contact,
        acknowledgements: input.acknowledgements,
        abuseSignals: {
          honeypotTriggered: previousSignals.honeypotTriggered || abuseSignals.honeypotTriggered,
          saveCount: (previousSignals.saveCount ?? 0) + 1,
          submitCount: previousSignals.submitCount ?? 0,
          lastUserAgent: abuseSignals.userAgent,
          lastIpHash: abuseSignals.ipHash,
        },
        updatedAt: now,
      })
      .where(eq(submissions.id, currentSubmission.id));
    await Promise.all([
      upsertRightsDraft(currentSubmission.id, input, now, revisionReason),
      upsertProcessDraft(currentSubmission.id, input, now, revisionReason),
      upsertProvenanceDraft(currentSubmission.id, input, now, revisionReason),
    ]);
    return buildAggregate(currentSubmission.id);
  }

  async function finalizeLatestDrafts(
    submissionId: string,
    input: SubmissionDraftInput,
    now: Date,
  ) {
    const [rights, process, provenance] = await Promise.all([
      loadLatestRightsVersion(submissionId),
      loadLatestProcessVersion(submissionId),
      loadLatestProvenanceVersion(submissionId),
    ]);
    if (rights?.status === "draft") {
      await db
        .update(rightsDeclarations)
        .set({
          status: "attested",
          attestation: input.rights.attestation,
          attestedAt: now,
        })
        .where(eq(rightsDeclarations.id, rights.id));
    }
    if (process?.status === "draft") {
      await db
        .update(creativeProcessDisclosures)
        .set({ status: "finalized", finalizedAt: now })
        .where(eq(creativeProcessDisclosures.id, process.id));
    }
    if (provenance?.status === "draft") {
      await db
        .update(provenanceRecords)
        .set({ status: "finalized", finalizedAt: now })
        .where(eq(provenanceRecords.id, provenance.id));
    }
  }

  async function recordActivity(
    submissionId: string,
    activityType: SubmissionActivityType,
    actorRole: SubmissionActorRole,
    createdAt: Date,
    values: Partial<typeof submissionActivities.$inferInsert> = {},
  ) {
    await db.insert(submissionActivities).values({
      submissionId,
      activityType,
      actorRole,
      createdAt,
      metadata: emptyMetadata(),
      ...values,
    });
  }

  async function currentAggregateFromToken(tokenHash: string, now: Date) {
    const invitation = await loadValidInvitationByHash(tokenHash, now);
    if (!invitation) return null;
    await touchInvitation(invitation.id, now);
    const existing = await loadSubmissionByInvitationId(invitation.id);
    if (!existing) return null;
    return buildAggregate(existing.id);
  }

  return {
    async findInvitationByTokenHash(tokenHash, now) {
      const invitation = await loadValidInvitationByHash(tokenHash, now);
      if (!invitation) return null;
      await touchInvitation(invitation.id, now);
      return mapInvitation(invitation);
    },
    async findByInvitationTokenHash(tokenHash, now) {
      return currentAggregateFromToken(tokenHash, now);
    },
    async saveDraftByInvitationTokenHash(tokenHash, input, now, abuseSignals, revisionReason) {
      const invitation = await loadValidInvitationByHash(tokenHash, now);
      if (!invitation) return null;
      await touchInvitation(invitation.id, now);
      return upsertSubmissionDraft(
        invitation,
        sanitizeDraftInput(input),
        now,
        abuseSignals,
        revisionReason,
      );
    },
    async submitByInvitationTokenHash(tokenHash, input, now, abuseSignals, revisionReason) {
      const invitation = await loadValidInvitationByHash(tokenHash, now);
      if (!invitation) return null;
      const sanitized = sanitizeDraftInput(input);
      const aggregate = await upsertSubmissionDraft(
        invitation,
        sanitized,
        now,
        abuseSignals,
        revisionReason,
      );
      if (!aggregate) return null;
      await finalizeLatestDrafts(aggregate.submission.id, sanitized, now);
      const nextStatus =
        aggregate.submission.status === "draft" ? "received" : aggregate.submission.status;
      await db
        .update(submissions)
        .set({
          status: nextStatus,
          submittedAt: aggregate.submission.submittedAt ?? now,
          updatedAt: now,
        })
        .where(eq(submissions.id, aggregate.submission.id));
      if (aggregate.submission.status === "draft") {
        await recordActivity(aggregate.submission.id, "status_change", "submitter", now, {
          actorEmail: sanitized.contact.contactEmail,
          fromStatus: "draft",
          toStatus: "received",
        });
      } else if (aggregate.submission.status === "clarification_requested") {
        await recordActivity(aggregate.submission.id, "clarification_response", "submitter", now, {
          actorEmail: sanitized.contact.contactEmail,
          message: "Clarification response submitted.",
        });
      }
      return buildAggregate(aggregate.submission.id);
    },
    async withdrawByInvitationTokenHash(tokenHash, now, message) {
      const aggregate = await currentAggregateFromToken(tokenHash, now);
      if (!aggregate) return null;
      await db
        .update(submissions)
        .set({ status: "withdrawn", withdrawnAt: now, updatedAt: now })
        .where(eq(submissions.id, aggregate.submission.id));
      await recordActivity(aggregate.submission.id, "status_change", "submitter", now, {
        actorEmail: aggregate.submission.submitterEmail,
        fromStatus: aggregate.submission.status,
        toStatus: "withdrawn",
      });
      if (message?.trim()) {
        await recordActivity(aggregate.submission.id, "note", "submitter", now, {
          actorEmail: aggregate.submission.submitterEmail,
          message: message.trim(),
        });
      }
      return buildAggregate(aggregate.submission.id);
    },
    async listCuratorSubmissions(filter = {}) {
      const conditions = [];
      if (filter.status && filter.status !== "all") {
        conditions.push(eq(submissions.status, filter.status));
      }
      if (filter.assignedTo && filter.assignedTo !== "all") {
        conditions.push(eq(submissions.assignedCuratorEmail, filter.assignedTo));
      }
      const rows = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(submissions.submittedAt), desc(submissions.updatedAt));
      const values = await Promise.all(rows.map(({ id }) => buildAggregate(id)));
      return values.filter((value): value is SubmissionAggregate => Boolean(value));
    },
    async findCuratorSubmission(submissionId) {
      return buildAggregate(submissionId);
    },
    async assignCurator(input) {
      const aggregate = await buildAggregate(input.submissionId);
      if (!aggregate) return null;
      await db
        .update(submissions)
        .set({
          assignedCuratorId: input.curator.id,
          assignedCuratorEmail: input.curator.email,
          assignedAt: input.assignedAt,
          updatedAt: input.assignedAt,
        })
        .where(eq(submissions.id, input.submissionId));
      await recordActivity(input.submissionId, "assignment", "curator", input.assignedAt, {
        actorId: input.curator.id,
        actorEmail: input.curator.email,
        message: `Assigned to ${input.curator.email}`,
      });
      return buildAggregate(input.submissionId);
    },
    async transitionStatus(input) {
      const aggregate = await buildAggregate(input.submissionId);
      if (!aggregate) return null;
      await db
        .update(submissions)
        .set({
          status: input.toStatus,
          reviewedAt:
            input.toStatus === "eligibility_review" ||
            input.toStatus === "listening" ||
            input.toStatus === "clarification_requested"
              ? (aggregate.submission.reviewedAt ?? input.transitionedAt)
              : aggregate.submission.reviewedAt,
          withdrawnAt:
            input.toStatus === "withdrawn"
              ? input.transitionedAt
              : aggregate.submission.withdrawnAt,
          updatedAt: input.transitionedAt,
        })
        .where(eq(submissions.id, input.submissionId));
      await recordActivity(input.submissionId, "status_change", "curator", input.transitionedAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        fromStatus: aggregate.submission.status,
        toStatus: input.toStatus,
        claimKey: input.claimKey ?? null,
        message: input.note ?? null,
      });
      return buildAggregate(input.submissionId);
    },
    async acceptSubmission(input) {
      const aggregate = await buildAggregate(input.submissionId);
      if (!aggregate) return null;
      await db
        .update(submissions)
        .set({
          status: "accepted",
          acceptedAt: input.acceptedAt,
          reviewedAt: aggregate.submission.reviewedAt ?? input.acceptedAt,
          resultingReleaseId: input.resultingReleaseId ?? null,
          resultingTrackId: input.resultingTrackId ?? null,
          acceptedRightsDeclarationId: aggregate.rights.id,
          acceptedCreativeProcessDisclosureId: aggregate.process.id,
          acceptedProvenanceRecordId: aggregate.provenance.id,
          rejectionReason: null,
          updatedAt: input.acceptedAt,
        })
        .where(eq(submissions.id, input.submissionId));
      await recordActivity(input.submissionId, "status_change", "curator", input.acceptedAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        fromStatus: aggregate.submission.status,
        toStatus: "accepted",
        message: input.note ?? null,
      });
      return buildAggregate(input.submissionId);
    },
    async rejectSubmission(input) {
      const aggregate = await buildAggregate(input.submissionId);
      if (!aggregate) return null;
      await db
        .update(submissions)
        .set({
          status: "rejected",
          rejectedAt: input.rejectedAt,
          reviewedAt: aggregate.submission.reviewedAt ?? input.rejectedAt,
          rejectionReason: input.reason,
          updatedAt: input.rejectedAt,
        })
        .where(eq(submissions.id, input.submissionId));
      await recordActivity(input.submissionId, "status_change", "curator", input.rejectedAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        fromStatus: aggregate.submission.status,
        toStatus: "rejected",
        message: input.reason,
      });
      return buildAggregate(input.submissionId);
    },
    async addNote(input) {
      const aggregate = await buildAggregate(input.submissionId);
      if (!aggregate) return null;
      await recordActivity(input.submissionId, "note", "curator", input.createdAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        message: input.message,
      });
      return buildAggregate(input.submissionId);
    },
    async addClarification(input) {
      const aggregate = await buildAggregate(input.submissionId);
      if (!aggregate) return null;
      await db
        .update(submissions)
        .set({
          status: "clarification_requested",
          reviewedAt: aggregate.submission.reviewedAt ?? input.createdAt,
          updatedAt: input.createdAt,
        })
        .where(eq(submissions.id, input.submissionId));
      await recordActivity(input.submissionId, "status_change", "curator", input.createdAt, {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        fromStatus: aggregate.submission.status,
        toStatus: "clarification_requested",
        claimKey: input.claimKey,
      });
      await recordActivity(
        input.submissionId,
        "clarification_question",
        "curator",
        input.createdAt,
        {
          actorId: input.actor.id,
          actorEmail: input.actor.email,
          claimKey: input.claimKey,
          message: input.message,
        },
      );
      return buildAggregate(input.submissionId);
    },
    async addClarificationResponse(input) {
      const aggregate = await buildAggregate(input.submissionId);
      if (!aggregate) return null;
      await recordActivity(
        input.submissionId,
        "clarification_response",
        "submitter",
        input.createdAt,
        {
          actorEmail: input.actorEmail,
          message: input.message,
        },
      );
      return buildAggregate(input.submissionId);
    },
    async createEvidenceUploadSession(tokenHash, declaration, now) {
      const aggregate = await currentAggregateFromToken(tokenHash, now);
      if (!aggregate || aggregate.provenance.status !== "draft") return null;
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
      const objectKey = `private/evidence/${aggregate.submission.publicReference}/${crypto.randomUUID()}-${declaration.filename.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
      const [row] = await db
        .insert(evidenceUploadSessions)
        .values({
          submissionId: aggregate.submission.id,
          provenanceRecordId: aggregate.provenance.id,
          objectKey,
          originalFilename: declaration.filename,
          mimeType: declaration.mimeType,
          checksumSha256: declaration.checksumSha256,
          byteSize: declaration.byteSize,
          actorRole: "submitter",
          actorEmail: aggregate.submission.submitterEmail,
          expiresAt,
        })
        .returning();
      return row;
    },
    async getEvidenceUploadSession(sessionId) {
      const [row] = await db
        .select()
        .from(evidenceUploadSessions)
        .where(eq(evidenceUploadSessions.id, sessionId))
        .limit(1);
      return row ?? null;
    },
    async completeEvidenceUploadSession(sessionId, now) {
      const [session] = await db
        .select()
        .from(evidenceUploadSessions)
        .where(eq(evidenceUploadSessions.id, sessionId))
        .limit(1);
      if (!session || session.status !== "pending") return null;
      const [evidence] = await db
        .insert(provenanceEvidence)
        .values({
          provenanceRecordId: session.provenanceRecordId,
          storageProvider: "private-r2",
          objectKey: session.objectKey,
          originalFilename: session.originalFilename,
          mimeType: session.mimeType,
          checksumSha256: session.checksumSha256,
          byteSize: session.byteSize,
          malwareStatus: "pending_review",
        })
        .returning();
      await db
        .update(evidenceUploadSessions)
        .set({ status: "completed", completedAt: now, updatedAt: now })
        .where(eq(evidenceUploadSessions.id, sessionId));
      return mapEvidence(evidence);
    },
    async failEvidenceUploadSession(sessionId, now, failureReason) {
      const rows = await db
        .update(evidenceUploadSessions)
        .set({ status: "failed", failureReason, updatedAt: now })
        .where(eq(evidenceUploadSessions.id, sessionId))
        .returning({ id: evidenceUploadSessions.id });
      return rows.length > 0;
    },
    async cleanupExpiredEvidenceUploadSessions(now) {
      const expired = await db
        .select({ id: evidenceUploadSessions.id })
        .from(evidenceUploadSessions)
        .where(
          and(
            eq(evidenceUploadSessions.status, "pending"),
            lt(evidenceUploadSessions.expiresAt, now),
          ),
        );
      if (expired.length === 0) return 0;
      await db
        .update(evidenceUploadSessions)
        .set({ status: "abandoned", failureReason: "Expired before completion", updatedAt: now })
        .where(
          inArray(
            evidenceUploadSessions.id,
            expired.map(({ id }) => id),
          ),
        );
      return expired.length;
    },
    async updateEvidenceMalwareStatus(evidenceId, actor, now, malwareStatus, note) {
      const [record] = await db
        .select({
          evidenceId: provenanceEvidence.id,
          submissionId: submissions.id,
        })
        .from(provenanceEvidence)
        .innerJoin(
          provenanceRecords,
          eq(provenanceRecords.id, provenanceEvidence.provenanceRecordId),
        )
        .innerJoin(submissions, eq(submissions.id, provenanceRecords.submissionId))
        .where(eq(provenanceEvidence.id, evidenceId))
        .limit(1);
      if (!record) return null;
      await db
        .update(provenanceEvidence)
        .set({
          malwareStatus,
          scheduledDeletionAt:
            malwareStatus === "quarantined" || malwareStatus === "rejected" ? now : null,
        })
        .where(eq(provenanceEvidence.id, evidenceId));
      await recordActivity(record.submissionId, "note", "curator", now, {
        actorId: actor.id,
        actorEmail: actor.email,
        message: note ?? `Evidence ${evidenceId} marked ${malwareStatus}.`,
      });
      return buildAggregate(record.submissionId);
    },
    async createEvidenceAccessGrant(evidenceId, actor, now, expiresAt, tokenHash) {
      const [record] = await db
        .select()
        .from(provenanceEvidence)
        .where(
          and(
            eq(provenanceEvidence.id, evidenceId),
            or(
              eq(provenanceEvidence.malwareStatus, "pending_review"),
              eq(provenanceEvidence.malwareStatus, "cleared"),
            ),
          ),
        )
        .limit(1);
      if (!record) return null;
      const [grant] = await db
        .insert(provenanceEvidenceAccessGrants)
        .values({
          evidenceId,
          tokenHash,
          actorId: actor.id,
          actorEmail: actor.email,
          expiresAt,
        })
        .returning();
      await db.insert(provenanceEvidenceAccessAudit).values({
        evidenceId,
        grantId: grant.id,
        actorId: actor.id,
        actorEmail: actor.email,
        action: "grant_created",
        occurredAt: now,
      });
      return grant;
    },
    async consumeEvidenceAccessGrant(tokenHash, now) {
      const [row] = await db
        .select({
          grantId: provenanceEvidenceAccessGrants.id,
          evidenceId: provenanceEvidence.id,
          objectKey: provenanceEvidence.objectKey,
          mimeType: provenanceEvidence.mimeType,
          originalFilename: provenanceEvidence.originalFilename,
          actorId: provenanceEvidenceAccessGrants.actorId,
          actorEmail: provenanceEvidenceAccessGrants.actorEmail,
        })
        .from(provenanceEvidenceAccessGrants)
        .innerJoin(
          provenanceEvidence,
          eq(provenanceEvidence.id, provenanceEvidenceAccessGrants.evidenceId),
        )
        .where(
          and(
            eq(provenanceEvidenceAccessGrants.tokenHash, tokenHash),
            sql`${provenanceEvidenceAccessGrants.expiresAt} > ${now}`,
            isNull(provenanceEvidence.deletedAt),
            or(
              eq(provenanceEvidence.malwareStatus, "pending_review"),
              eq(provenanceEvidence.malwareStatus, "cleared"),
            ),
          ),
        )
        .limit(1);
      if (!row) return null;
      await db
        .update(provenanceEvidenceAccessGrants)
        .set({ downloadedAt: now })
        .where(eq(provenanceEvidenceAccessGrants.id, row.grantId));
      await db.insert(provenanceEvidenceAccessAudit).values({
        evidenceId: row.evidenceId,
        grantId: row.grantId,
        actorId: row.actorId,
        actorEmail: row.actorEmail,
        action: "downloaded",
        occurredAt: now,
      });
      return {
        evidenceId: row.evidenceId,
        grantId: row.grantId,
        objectKey: row.objectKey,
        mimeType: row.mimeType,
        originalFilename: row.originalFilename,
      };
    },
    async recordEmailActivity(submissionId, now, recipientEmail, templateKey) {
      await recordActivity(submissionId, "email", "system", now, {
        actorEmail: "system@sunstrucksynapse.com",
        message: `${templateKey} -> ${recipientEmail}`,
        metadata: { templateKey, recipientEmail },
      });
    },
  };
}
