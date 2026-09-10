# Curator workspace delivery stack

This document is the handover map for replacing the expanded curator submission page with a dedicated, scalable queue and review workspace. Every pull request remains Draft until the maintainer explicitly changes its review state.

## Product journey

```text
Queue -> audition -> open or claim -> listen -> score -> grade -> rationale -> finish and next
                                      \-> ask artist -> waiting -> next track
```

The normal journey must not expose workflow-state controls. Exceptional actions remain available from contextual menus. Human curators retain the final editorial decision.

## Stack

| Order | Branch                                       | Pull request                                                        | Outcome                                                                              |
| ----- | -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1     | `agent/curator-design-foundation`            | [#75](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/75) | Operational tokens, shared view contracts, fixtures, primitives, and curator shell   |
| 2     | `agent/curator-queue-prototype`              | [#76](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/76) | Interactive queue and preview in Storybook                                           |
| 3     | `agent/curator-review-prototype`             | [#77](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/77) | Interactive focused review in Storybook                                              |
| 4     | `agent/curator-invitations-prototype`        | [#78](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/78) | Interactive invitation management in Storybook                                       |
| 5     | `agent/listener-experience-prototype`        | [#79](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/79) | Full listener experience and shared cross-surface product identity in Storybook      |
| 6     | `agent/listener-identity-feedback-prototype` | [#80](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/80) | Listener sign-in, five weekly downvotes, undo, balance, and curator access states    |
| 7     | `agent/listener-genre-catalogue-prototype`   | [#81](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/81) | Homepage genre rail and interactive genre catalogue in the shared listener shell     |
| Gate  | —                                            | —                                                                   | Maintainer approves the complete Storybook journey                                   |
| 8     | `agent/curator-queue-integration`            | not started                                                         | Dedicated production shell, real queue, search, filters, audition, and claim         |
| 9     | `agent/curator-review-integration`           | not started                                                         | Persistent review, clarification, finalization, and automatic next track             |
| 10    | `agent/curator-invitations-integration`      | not started                                                         | Real invitation list, one-time reveal, revocation, and replacement                   |
| 11    | `agent/curator-workspace-cutover`            | not started                                                         | Remove legacy UI and complete accessibility, responsive, E2E, and documentation work |

## Current checkpoint

The seven prototype PRs are open as Drafts and the production routes are unchanged. Review these six dark or light Storybook journeys before admitting integration work:

1. Queue: search, status filters, selection, inline audition, and the compact preview.
2. Focused review: listening, four scores, A/B/C grade, rationale, ask-artist exception, and finish-and-next.
3. Invitations: lifecycle filters, create, one-time secret reveal, revoke, and replace.
4. Listener experience: header, player, catalogue selection, queueing, playback controls, and shared theme/brand behavior.
5. Identity and feedback: anonymous listening, listener sign-in, weekly balance, downvote/undo, sign-out, and curator access states.
6. Genre catalogue: homepage genre entry, genre switching, selected-genre catalogue, queueing, and playback continuity.

The next eligible branch is `agent/curator-queue-integration`, but it must not start until the maintainer accepts the prototype journey or records requested changes.

## Handover contract

Every PR description records:

- its parent branch and position in this stack;
- its single product outcome and observable acceptance criteria;
- explicit exclusions;
- affected view, service, persistence, and route contracts;
- Storybook entry points;
- focused verification already performed;
- migration or deployment requirements;
- known gaps assigned to the next PR.

Merge from the bottom of the stack upward. After a parent merges, retarget the immediate child to `main` and keep later PRs based on their immediate predecessor.

## Agentic extension boundary

Future assistance must produce attributable suggestions with supporting evidence. An agent does not write a human score or final grade directly. The curator accepts, edits, or ignores a suggestion and finalizes through the same authorized application command. Agent integration is deliberately deferred until the human workflow is effective.
