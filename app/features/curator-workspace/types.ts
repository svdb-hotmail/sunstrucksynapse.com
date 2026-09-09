export type CuratorSection =
  | "queue"
  | "mine"
  | "waiting"
  | "completed"
  | "invitations"
  | "collections"
  | "analytics"
  | "settings";

export type CuratorReadiness = "ready" | "needs_audio" | "needs_information" | "flagged";

export type CuratorRightsState = "attested" | "needs_review" | "blocked";

export interface CuratorNavigationItem {
  id: CuratorSection;
  label: string;
  href: string;
  count?: number;
  separatorBefore?: boolean;
}

export interface CuratorIdentityView {
  name: string;
  email: string;
  initials: string;
}

export interface CuratorQueueItemView {
  id: string;
  publicReference: string;
  title: string;
  artistName: string;
  submitterEmail: string;
  durationMs: number | null;
  submittedAt: string;
  status:
    | "received"
    | "eligibility_review"
    | "listening"
    | "clarification_requested"
    | "accepted"
    | "rejected"
    | "withdrawn";
  readiness: CuratorReadiness;
  rights: CuratorRightsState;
  assignedCuratorName: string | null;
  audioUrl: string | null;
}

export interface CuratorReviewView {
  submission: CuratorQueueItemView;
  artistBiography: string;
  artistLocation: string;
  creativeContribution: string;
  aiTools: string[];
  territories: string[];
  rightsSummary: string;
  provenanceSummary: string;
  evidenceCount: number;
  activities: Array<{ id: string; label: string; timestamp: string }>;
  files: Array<{ id: string; filename: string; detail: string }>;
}

export type CuratorInvitationStatus = "active" | "used" | "expired" | "revoked";

export interface CuratorInvitationView {
  id: string;
  publicReference: string;
  inviteeName: string | null;
  inviteeEmail: string;
  createdAt: string;
  expiresAt: string;
  status: CuratorInvitationStatus;
  submissionId: string | null;
  submissionTitle: string | null;
}
