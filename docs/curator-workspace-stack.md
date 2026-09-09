# Curator workspace delivery stack

This document is the handover map for replacing the expanded curator submission page with a dedicated, scalable queue and review workspace. Every pull request remains Draft until the maintainer explicitly changes its review state.

## Product journey

```text
Queue -> audition -> open or claim -> listen -> score -> grade -> rationale -> finish and next
                                      \-> ask artist -> waiting -> next track
```

The normal journey must not expose workflow-state controls. Exceptional actions remain available from contextual menus. Human curators retain the final editorial decision.

## Stack

| Order | Branch                                  | Outcome                                                                              |
| ----- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| 1     | `agent/curator-design-foundation`       | Operational tokens, shared view contracts, fixtures, primitives, and curator shell   |
| 2     | `agent/curator-queue-prototype`         | Interactive queue and preview in Storybook                                           |
| 3     | `agent/curator-review-prototype`        | Interactive focused review in Storybook                                              |
| 4     | `agent/curator-invitations-prototype`   | Interactive invitation management in Storybook                                       |
| Gate  | —                                       | Maintainer approves the complete Storybook journey                                   |
| 5     | `agent/curator-queue-integration`       | Dedicated production shell, real queue, search, filters, audition, and claim         |
| 6     | `agent/curator-review-integration`      | Persistent review, clarification, finalization, and automatic next track             |
| 7     | `agent/curator-invitations-integration` | Real invitation list, one-time reveal, revocation, and replacement                   |
| 8     | `agent/curator-workspace-cutover`       | Remove legacy UI and complete accessibility, responsive, E2E, and documentation work |

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
