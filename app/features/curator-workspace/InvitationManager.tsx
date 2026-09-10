import { useMemo, useState, type FormEvent } from "react";

import { CuratorBadge, CuratorButton, CuratorTabs } from "./CuratorPrimitives";
import type { CuratorInvitationStatus, CuratorInvitationView } from "./types";

type InvitationFilter = "all" | CuratorInvitationStatus;

export interface InvitationDraft {
  inviteeEmail: string;
  inviteeName: string;
  expiresInDays: number;
}

export interface RevealedInvitation {
  invitation: CuratorInvitationView;
  secretUrl: string;
}

const statusTone = {
  active: "success",
  used: "info",
  expired: "danger",
  revoked: "neutral",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function InvitationManager({
  invitations,
  query,
  selectedId,
  onCreate,
  onReplace,
  onRevoke,
  onSelect,
}: {
  invitations: CuratorInvitationView[];
  query: string;
  selectedId: string | null;
  onCreate: (draft: InvitationDraft) => Promise<RevealedInvitation>;
  onReplace: (invitation: CuratorInvitationView) => Promise<RevealedInvitation>;
  onRevoke: (invitation: CuratorInvitationView) => Promise<void>;
  onSelect: (invitation: CuratorInvitationView) => void;
}) {
  const [filter, setFilter] = useState<InvitationFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"replace" | "revoke" | null>(null);
  const [reveal, setReveal] = useState<RevealedInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyState, setCopyState] = useState("Copy private link");
  const selected = invitations.find((invitation) => invitation.id === selectedId) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleInvitations = useMemo(
    () =>
      invitations.filter(
        (invitation) =>
          (filter === "all" || invitation.status === filter) &&
          (!normalizedQuery ||
            invitation.inviteeName?.toLowerCase().includes(normalizedQuery) ||
            invitation.inviteeEmail.toLowerCase().includes(normalizedQuery) ||
            invitation.publicReference.toLowerCase().includes(normalizedQuery)),
      ),
    [filter, invitations, normalizedQuery],
  );
  const counts = useMemo(
    () => ({
      all: invitations.length,
      active: invitations.filter((item) => item.status === "active").length,
      used: invitations.filter((item) => item.status === "used").length,
      expired: invitations.filter((item) => item.status === "expired").length,
      revoked: invitations.filter((item) => item.status === "revoked").length,
    }),
    [invitations],
  );

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const created = await onCreate({
        inviteeName: String(data.get("inviteeName") ?? "").trim(),
        inviteeEmail: String(data.get("inviteeEmail") ?? "").trim(),
        expiresInDays: Number(data.get("expiresInDays") ?? 30),
      });
      setCreateOpen(false);
      setReveal(created);
      setCopyState("Copy private link");
    } finally {
      setBusy(false);
    }
  };

  const completePendingAction = async () => {
    if (!selected || !pendingAction) return;
    setBusy(true);
    try {
      if (pendingAction === "revoke") {
        await onRevoke(selected);
      } else {
        const replacement = await onReplace(selected);
        setReveal(replacement);
        setCopyState("Copy private link");
      }
      setPendingAction(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="curator-invitations-layout">
      <section className="curator-invitations" aria-labelledby="invitations-title">
        <header className="curator-page-heading">
          <div>
            <p className="curator-overline">Private intake</p>
            <h1 id="invitations-title">Invitations</h1>
            <p>Create and manage single-use submission links.</p>
          </div>
          <CuratorButton variant="primary" onClick={() => setCreateOpen(true)}>
            + Create invitation
          </CuratorButton>
        </header>
        <CuratorTabs
          active={filter}
          label="Invitation status"
          onChange={setFilter}
          options={(
            [
              ["all", "All"],
              ["active", "Active"],
              ["used", "Used"],
              ["expired", "Expired"],
              ["revoked", "Revoked"],
            ] as const
          ).map(([id, label]) => ({ id, label, count: counts[id] }))}
        />
        <div className="curator-invitations__table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invitee</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Submission</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvitations.map((invitation) => (
                <tr
                  key={invitation.id}
                  className={invitation.id === selectedId ? "is-selected" : undefined}
                  tabIndex={0}
                  onClick={() => onSelect(invitation)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onSelect(invitation);
                  }}
                >
                  <td>
                    <strong>{invitation.inviteeName || "Unnamed invitee"}</strong>
                    <small>{invitation.inviteeEmail}</small>
                  </td>
                  <td>{formatDate(invitation.createdAt)}</td>
                  <td>{formatDate(invitation.expiresAt)}</td>
                  <td>
                    <CuratorBadge tone={statusTone[invitation.status]}>
                      {invitation.status}
                    </CuratorBadge>
                  </td>
                  <td>{invitation.submissionTitle ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleInvitations.length === 0 ? (
            <p className="curator-invitations__empty">No invitations match this view.</p>
          ) : null}
        </div>
      </section>

      <aside className="curator-invitation-detail" aria-label="Invitation detail">
        {selected ? (
          <>
            <header>
              <span className="curator-avatar" aria-hidden="true">
                {(selected.inviteeName ?? selected.inviteeEmail).slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h2>{selected.inviteeName || "Unnamed invitee"}</h2>
                <p>{selected.inviteeEmail}</p>
              </div>
              <CuratorBadge tone={statusTone[selected.status]}>{selected.status}</CuratorBadge>
            </header>
            <section>
              <h3>Invitation</h3>
              <dl>
                <div>
                  <dt>Reference</dt>
                  <dd>{selected.publicReference}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{formatDate(selected.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Submission</dt>
                  <dd>{selected.submissionTitle ?? "Not started"}</dd>
                </div>
              </dl>
              <p className="curator-invitation-detail__privacy">
                The private link is intentionally unavailable after creation.
              </p>
            </section>
            {selected.status === "active" ? (
              <footer>
                <CuratorButton variant="secondary" onClick={() => setPendingAction("replace")}>
                  Replace link
                </CuratorButton>
                <CuratorButton variant="danger" onClick={() => setPendingAction("revoke")}>
                  Revoke
                </CuratorButton>
              </footer>
            ) : null}
          </>
        ) : (
          <p>Select an invitation to inspect its lifecycle.</p>
        )}
      </aside>

      {createOpen ? (
        <div className="curator-dialog-backdrop" role="presentation">
          <form
            className="curator-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-invitation-title"
            onSubmit={submitCreate}
          >
            <h2 id="create-invitation-title">Create private invitation</h2>
            <p>The secret submission link will be shown once.</p>
            <label>
              Invitee name
              <input name="inviteeName" autoComplete="name" required />
            </label>
            <label>
              Email
              <input name="inviteeEmail" type="email" autoComplete="email" required />
            </label>
            <label>
              Expires after
              <select name="expiresInDays" defaultValue="30">
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
              </select>
            </label>
            <footer>
              <CuratorButton variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </CuratorButton>
              <CuratorButton variant="primary" type="submit" disabled={busy}>
                Create link
              </CuratorButton>
            </footer>
          </form>
        </div>
      ) : null}

      {pendingAction && selected ? (
        <div className="curator-dialog-backdrop" role="presentation">
          <section
            className="curator-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="invitation-action-title"
          >
            <h2 id="invitation-action-title">
              {pendingAction === "replace" ? "Replace this link?" : "Revoke this invitation?"}
            </h2>
            <p>
              {pendingAction === "replace"
                ? "The current link stops working immediately. A new one-time link will be created."
                : "The private link stops working immediately. This cannot be undone."}
            </p>
            <footer>
              <CuratorButton variant="ghost" onClick={() => setPendingAction(null)}>
                Cancel
              </CuratorButton>
              <CuratorButton
                variant={pendingAction === "revoke" ? "danger" : "primary"}
                disabled={busy}
                onClick={() => void completePendingAction()}
              >
                {pendingAction === "replace" ? "Replace and reveal new link" : "Revoke invitation"}
              </CuratorButton>
            </footer>
          </section>
        </div>
      ) : null}

      {reveal ? (
        <div className="curator-dialog-backdrop" role="presentation">
          <section
            className="curator-dialog curator-secret-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="secret-title"
          >
            <p className="curator-overline">Shown once</p>
            <h2 id="secret-title">Copy the private link now</h2>
            <p>
              After you close this window, the secret cannot be recovered. Replace it if it is lost.
            </p>
            <output>{reveal.secretUrl}</output>
            <footer>
              <CuratorButton
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard?.writeText(reveal.secretUrl);
                  setCopyState("Copied");
                }}
              >
                {copyState}
              </CuratorButton>
              <CuratorButton variant="primary" onClick={() => setReveal(null)}>
                I saved it
              </CuratorButton>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
