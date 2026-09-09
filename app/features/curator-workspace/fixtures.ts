import type {
  CuratorIdentityView,
  CuratorInvitationView,
  CuratorNavigationItem,
  CuratorQueueItemView,
  CuratorReviewView,
} from "./types";

export const curatorIdentityFixture: CuratorIdentityView = {
  name: "Samuel Vandenberg",
  email: "curator@sunsyn.art",
  initials: "SV",
};

export const curatorNavigationFixture: CuratorNavigationItem[] = [
  { id: "queue", label: "Queue", href: "/curator/submissions", count: 124 },
  { id: "mine", label: "Mine", href: "/curator/submissions?assignedTo=me", count: 8 },
  {
    id: "waiting",
    label: "Waiting",
    href: "/curator/submissions?status=clarification_requested",
    count: 23,
  },
  {
    id: "completed",
    label: "Completed",
    href: "/curator/submissions?status=completed",
    count: 317,
  },
  {
    id: "invitations",
    label: "Invitations",
    href: "/curator/invitations",
    count: 12,
    separatorBefore: true,
  },
  { id: "collections", label: "Collections", href: "/curator/collections", count: 28 },
  { id: "analytics", label: "Analytics", href: "/curator/analytics" },
  { id: "settings", label: "Settings", href: "/curator/settings" },
];

export const curatorQueueFixtures: CuratorQueueItemView[] = [
  {
    id: "submission-midnight-frequency",
    publicReference: "SUB-2026-7482",
    title: "Midnight Frequency",
    artistName: "Kairos Bloom",
    submitterEmail: "kairos@example.com",
    durationMs: 303_000,
    submittedAt: "2026-09-09T08:14:00.000Z",
    status: "received",
    readiness: "ready",
    rights: "attested",
    assignedCuratorName: null,
    audioUrl: null,
  },
  {
    id: "submission-liminal-space",
    publicReference: "SUB-2026-7478",
    title: "Liminal Space",
    artistName: "Nova Grey",
    submitterEmail: "nova@example.com",
    durationMs: 388_000,
    submittedAt: "2026-09-09T06:10:00.000Z",
    status: "listening",
    readiness: "ready",
    rights: "attested",
    assignedCuratorName: "Samuel Vandenberg",
    audioUrl: null,
  },
  {
    id: "submission-safe-in-static",
    publicReference: "SUB-2026-7469",
    title: "Safe in the Static",
    artistName: "The Hollow Years",
    submitterEmail: "hollow@example.com",
    durationMs: null,
    submittedAt: "2026-09-08T23:44:00.000Z",
    status: "received",
    readiness: "needs_audio",
    rights: "needs_review",
    assignedCuratorName: null,
    audioUrl: null,
  },
];

export const curatorReviewFixture: CuratorReviewView = {
  submission: curatorQueueFixtures[0]!,
  creativeContribution:
    "Composition, arrangement, vocal direction, editing, sound design, and final mix decisions.",
  aiTools: ["Flow Music", "Sketcher"],
  territories: ["Worldwide"],
  rightsSummary: "The submitter attests that they made and control the work.",
  provenanceSummary:
    "Iterative generation shaped through selection, arrangement, rerecording, and detailed production.",
  evidenceCount: 1,
};

export const curatorInvitationFixtures: CuratorInvitationView[] = [
  {
    id: "invitation-june-cabrera",
    publicReference: "INV-2026-0912",
    inviteeName: "June Cabrera",
    inviteeEmail: "june@example.com",
    createdAt: "2026-09-08T15:10:00.000Z",
    expiresAt: "2026-10-08T15:10:00.000Z",
    status: "active",
    submissionId: null,
    submissionTitle: null,
  },
  {
    id: "invitation-marcus-lee",
    publicReference: "INV-2026-0897",
    inviteeName: "Marcus Lee",
    inviteeEmail: "marcus@example.com",
    createdAt: "2026-09-02T09:30:00.000Z",
    expiresAt: "2026-10-02T09:30:00.000Z",
    status: "used",
    submissionId: "submission-rivers-and-radio",
    submissionTitle: "Rivers and Radio",
  },
];
