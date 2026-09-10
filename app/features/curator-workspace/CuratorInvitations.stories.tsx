import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CuratorShell } from "./CuratorShell";
import {
  createCuratorInvitationFixtures,
  curatorIdentityFixture,
  curatorNavigationFixture,
} from "./fixtures";
import {
  InvitationManager,
  type InvitationDraft,
  type RevealedInvitation,
} from "./InvitationManager";
import type { CuratorInvitationView } from "./types";

const startingInvitations = createCuratorInvitationFixtures();

function privateLink(reference: string) {
  return `https://sunstrucksynapse.com/submit/prototype-secret-${reference.toLowerCase()}`;
}

function InvitationsPrototype() {
  const [invitations, setInvitations] = useState(startingInvitations);
  const [selectedId, setSelectedId] = useState<string | null>(startingInvitations[0]?.id ?? null);
  const [query, setQuery] = useState("");

  const createInvitation = async (draft: InvitationDraft): Promise<RevealedInvitation> => {
    const sequence = invitations.length + 913;
    const invitation: CuratorInvitationView = {
      id: `invitation-prototype-${sequence}`,
      publicReference: `INV-2026-${sequence}`,
      inviteeName: draft.inviteeName,
      inviteeEmail: draft.inviteeEmail,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + draft.expiresInDays * 86_400_000).toISOString(),
      status: "active",
      submissionId: null,
      submissionTitle: null,
    };
    setInvitations((current) => [invitation, ...current]);
    setSelectedId(invitation.id);
    return { invitation, secretUrl: privateLink(invitation.publicReference) };
  };

  const replaceInvitation = async (current: CuratorInvitationView): Promise<RevealedInvitation> => {
    setInvitations((items) =>
      items.map((item) => (item.id === current.id ? { ...item, status: "revoked" } : item)),
    );
    return createInvitation({
      inviteeName: current.inviteeName ?? "",
      inviteeEmail: current.inviteeEmail,
      expiresInDays: 30,
    });
  };

  return (
    <CuratorShell
      activeSection="invitations"
      identity={curatorIdentityFixture}
      navigation={curatorNavigationFixture}
      onSearch={setQuery}
      searchPlaceholder="Search invitations, people, email, or reference"
      searchValue={query}
    >
      <InvitationManager
        invitations={invitations}
        query={query}
        selectedId={selectedId}
        onCreate={createInvitation}
        onReplace={replaceInvitation}
        onRevoke={async (invitation) => {
          setInvitations((current) =>
            current.map((item) =>
              item.id === invitation.id ? { ...item, status: "revoked" } : item,
            ),
          );
        }}
        onSelect={(invitation) => setSelectedId(invitation.id)}
      />
    </CuratorShell>
  );
}

const meta = {
  title: "Curator Workspace/Invitations/Interactive prototype",
  component: InvitationsPrototype,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof InvitationsPrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = { globals: { theme: "dark" } };
export const LightTheme: Story = { globals: { theme: "light" } };
