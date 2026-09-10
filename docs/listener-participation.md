# Listener identity, feedback, and rotation

This document records the maintainer-approved product behavior introduced by Draft PRs [#80](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/80) and [#81](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/81). The pull requests are interaction prototypes; they do not claim persistence or production authentication.

## Journey

```text
listen anonymously -> browse catalogue or genre -> optionally sign in
                                              -> spend a weekly downvote
                                              -> undo before weekly cutoff
```

Curators continue through Cloudflare Access. Listener authentication is a separate public identity boundary and its provider remains an explicit integration decision.

## Weekly feedback contract

- An authenticated listener receives five downvotes per weekly period.
- One downvote may be applied to one track in a period.
- The listener can undo that downvote before the weekly cutoff and recover the point.
- The interface always shows the remaining balance when the listener is signed in.
- Anonymous listeners can listen and browse; attempting to downvote opens sign-in.
- Individual votes and voter identities are not public.
- The production write path must authenticate and authorize on the server. Client state is not authority.

## Rotation contract

At the weekly cutoff, the system ranks tracks in the active radio rotation by unique authenticated downvotes. The selected tracks leave the active rotation and eligible curator-approved tracks take their places.

Replacement changes rotation membership only. It does not delete or unpublish catalogue records, alter curator grades, or make a rights decision. The integration must define minimum participation, deterministic tie-breaking, abuse controls, a curator safety hold, and an auditable rotation result before automation is enabled.

## Genre contract

- The listener navigation exposes Genres.
- The homepage provides a compact genre entry point.
- The genre catalogue provides a controlled directory and genre-focused track lists.
- Tracks remain playable and queueable without leaving the shared listener shell.
- Integration should replace free-text genre grouping with stable identifiers and preserve one primary navigation genre per track. Secondary classification may remain additive.

## Agentic boundary

Future agents may classify candidate genres, summarize listener signals, detect anomalies, and recommend rotation changes. Suggestions must retain evidence and provenance. An agent must not fabricate listener feedback, impersonate a listener, or silently delete or unpublish catalogue records.
