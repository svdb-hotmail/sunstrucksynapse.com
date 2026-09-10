import { useState } from "react";

import { AccessGate } from "~/components/AccessGate";

export interface ListenerAccountView {
  displayName: string;
  email: string;
  initials: string;
}

interface ListenerAccountControlProps {
  account: ListenerAccountView | null;
  remainingVotes: number;
  onOpenSignIn: () => void;
  onSignOut: () => void;
}

export function ListenerAccountControl({
  account,
  remainingVotes,
  onOpenSignIn,
  onSignOut,
}: ListenerAccountControlProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!account) {
    return (
      <button type="button" className="listener-sign-in" onClick={onOpenSignIn}>
        Sign in
      </button>
    );
  }

  return (
    <div className="listener-account">
      <button
        type="button"
        className="listener-account__trigger"
        aria-expanded={menuOpen}
        aria-controls="listener-account-menu"
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span className="listener-account__avatar" aria-hidden="true">
          {account.initials}
        </span>
        <span>
          <strong>{account.displayName}</strong>
          <small>{remainingVotes} votes left</small>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {menuOpen ? (
        <div id="listener-account-menu" className="listener-account__menu">
          <p>{account.email}</p>
          <p>{remainingVotes} of 5 weekly downvotes remaining</p>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface ListenerFeedbackControlProps {
  account: ListenerAccountView | null;
  hasVoted: boolean;
  remainingVotes: number;
  trackTitle: string;
  onOpenSignIn: () => void;
  onToggleVote: () => void;
}

export function ListenerFeedbackControl({
  account,
  hasVoted,
  remainingVotes,
  trackTitle,
  onOpenSignIn,
  onToggleVote,
}: ListenerFeedbackControlProps) {
  const canVote = hasVoted || remainingVotes > 0;

  return (
    <section className="listener-feedback" aria-label="Weekly listener feedback">
      <span className="listener-feedback__icon" aria-hidden="true">
        ↓
      </span>
      <span className="listener-feedback__copy">
        <strong>{hasVoted ? "Counted for next week" : "Not for me"}</strong>
        <small>
          {account
            ? `${remainingVotes} of 5 weekly downvotes left`
            : "Sign in to help shape next week’s rotation"}
        </small>
      </span>
      <button
        type="button"
        aria-label={
          account
            ? hasVoted
              ? `Undo downvote for ${trackTitle}`
              : `Downvote ${trackTitle}`
            : `Sign in to downvote ${trackTitle}`
        }
        aria-pressed={account ? hasVoted : undefined}
        disabled={Boolean(account) && !canVote}
        onClick={account ? onToggleVote : onOpenSignIn}
      >
        {account
          ? hasVoted
            ? "Undo"
            : remainingVotes > 0
              ? "Use 1 point"
              : "No points left"
          : "Sign in"}
      </button>
    </section>
  );
}

interface ListenerSignInDialogProps {
  onClose: () => void;
  onComplete: () => void;
}

export function ListenerSignInDialog({ onClose, onComplete }: ListenerSignInDialogProps) {
  return (
    <div className="listener-sign-in-dialog" role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="listener-sign-in-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <AccessGate
          context="listener"
          eyebrow="Listener account"
          heading="Shape next week’s rotation"
          message="Sign in to receive five downvotes each week. Listening stays open to everyone."
          action={
            <button type="button" className="access-gate__primary" onClick={onComplete}>
              Continue with email
            </button>
          }
          secondaryAction={
            <button type="button" className="access-gate__secondary" onClick={onClose}>
              Not now
            </button>
          }
        />
      </div>
    </div>
  );
}
