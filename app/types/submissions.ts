export type SubmissionKind = "track" | "release";

export type SubmissionStatus =
  | "draft"
  | "received"
  | "eligibility_review"
  | "listening"
  | "clarification_requested"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type SubmissionActorRole = "submitter" | "curator" | "system";

export type SubmissionActivityType =
  | "status_change"
  | "assignment"
  | "note"
  | "clarification_question"
  | "clarification_response"
  | "email"
  | "evidence_access";

export type EvidenceMalwareStatus = "pending_review" | "cleared" | "quarantined" | "rejected";

export interface ArtistSubmissionDetails {
  displayName: string;
  shortBiography: string;
  location: string;
  websiteUrl: string;
  socialUrl: string;
  priorWorkNotes: string;
}

export interface ReleaseSubmissionDetails {
  title: string;
  summary: string;
  plannedReleaseDate: string;
  labelName: string;
  distributorName: string;
  distributorReleaseId: string;
  territories: string[];
}

export interface TrackSubmissionDetails {
  title: string;
  versionTitle: string;
  durationNotes: string;
  isLeadSingle: boolean;
  lyricsSummary: string;
  isInstrumental: boolean;
}

export interface ContactSubmissionDetails {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  preferredContactMethod: "email" | "phone";
}

export interface SubmissionAcknowledgements {
  invitationConfirmed: boolean;
  accuracyConfirmed: boolean;
  rightsConfirmed: boolean;
  disclosureConfirmed: boolean;
  reviewProcessConfirmed: boolean;
}

export interface SubmissionAbuseSignals {
  honeypotTriggered: boolean;
  saveCount: number;
  submitCount: number;
  lastUserAgent: string | null;
  lastIpHash: string | null;
}

export interface HumanRoleDisclosure {
  name: string;
  role: string;
  contribution: string;
  isPublic: boolean;
}

export interface AiToolDisclosure {
  name: string;
  model: string;
  provider: string;
  purpose: string;
  isPublic: boolean;
}

export interface SubmissionProvenanceStep {
  position: number;
  processType: string;
  description: string;
  occurredAt: string | null;
}

export interface SubmissionProvenanceSource {
  position: number;
  sourceType:
    "original_recording" | "licensed_material" | "public_domain" | "generated_material" | "other";
  reference: string;
  rightsContext: string | null;
}

export interface PublicTrackDisclosure {
  trackTitle: string;
  releaseTitle: string;
  artistName: string;
  reviewedAt: string;
  rights: {
    authorityBasis: "original_author" | "licensed" | "public_domain";
    publicSummary: string;
    publicNotes: string | null;
    territories: string[];
    distributorName: string | null;
    distributorReleaseId: string | null;
    isrc: string | null;
  };
  process: {
    aiUsed: boolean;
    aiUseDescription: string | null;
    meaningfulHumanContribution: string;
    publicSummary: string;
    humanRoles: HumanRoleDisclosure[];
    aiTools: AiToolDisclosure[];
    lyricsUsed: boolean;
    lyricsDetails: string | null;
    voiceCloneUsed: boolean;
    voiceCloneDetails: string | null;
    samplesUsed: boolean;
    sampleDetails: string | null;
    sourceMaterialContext: string | null;
  };
  provenance: {
    summary: string;
    publicNotes: string | null;
    sources: Array<{
      sourceType: string;
      reference: string;
      rightsContext: string | null;
    }>;
    steps: Array<{
      position: number;
      processType: string;
      description: string;
      occurredAt: string | null;
    }>;
  };
}
