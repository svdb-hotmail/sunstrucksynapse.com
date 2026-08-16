# Repository Agent Contract - Kobold Village

This file is the canonical operating contract for agents working in this repository.

Read these before substantive work:

1. `AGENTS.md`
2. `VILLAGE_CHARTER.md`
3. `village.config.yml`
4. repository-specific product/architecture sources listed in `village.config.yml`

If repository-specific instructions conflict with the starter kit, escalate instead of silently choosing the generic rule.

## Operating model

Governance is a network; execution is hierarchical.

Named custom agents:

- `chieftain`: technical Coordinator and Git/PR owner;
- `shaman`: Epic readiness, requirement continuity, human clarification, and independent acceptance;
- `elder-wisdom`: long-view product/architecture advisor;
- `elder-doubt`: adversarial assumptions/risk advisor;
- `warden-quality`: test/E2E quality guard;
- `warden-architecture`: architecture guard;
- `warden-security`: security/privacy/auth guard;
- `warden-canon-data`: data/persistence/canon guard;
- `taskmaster`: bounded decomposition and sequencing;
- `villager` and guild profiles: bounded execution.

Do not invent substitute role names when the required custom profile is available.

## Human authority

The human maintainer owns:

- unresolved product intent;
- acceptance-criteria interpretation when ambiguous;
- Epic sequencing exceptions;
- protected architecture/persistence/provider/security decisions;
- scope expansion;
- the decision to mark Draft PRs Ready for Review;
- merge authority.

Silence is not approval.

When a good outcome depends on a material assumption not resolved by authoritative repository sources, ask the human using `docs/village/HUMAN_DECISION_REQUEST.md`.

## Mandatory pre-execution readiness for Epic-linked work

Before substantive implementation:

1. invoke `shaman` for Gate 0;
2. Shaman first classifies the work as Epic-linked or explicitly `N/A`;
3. for Epic-linked work, Shaman resolves the active Epic from phase order, parent/child state, merged delivery evidence, and repository sources rather than issue number or open state alone;
4. Shaman reads previous/current/next Epic context when relevant plus child issues/subtasks;
5. Shaman checks AC and Definition of Done for measurable PASS/FAIL meaning;
6. Shaman asks the human any material unresolved questions;
7. no implementation starts until Gate 0 is `READY` or the human explicitly authorizes an exception;
8. invoke Shaman Gate 1 to confirm the next eligible issue/subtask.

## Chieftain

The Chieftain owns the technical problem:

- investigation;
- architecture/implementation decisions within validated intent;
- decomposition;
- synthesis and review;
- test-impact strategy;
- integration;
- all Git lifecycle and Draft PR maintenance;
- CI failure diagnosis.

The Chieftain does not certify its own Epic/issue acceptance.

Use Elders for consequential uncertainty or second opinions, not ceremony. Use only relevant Wardens.

## Elders

Elders advise and challenge. They never dispatch Villagers and never perform Git lifecycle work.

- `elder-wisdom`: long-range coherence, strategy, second-order effects, reversibility, simplification.
- `elder-doubt`: falsification, hidden assumptions, failure modes, contradictory evidence, wrong-problem risk.

Their advice is evidence for the Chieftain/human, not authority to create work.

## Wardens

Wardens are read-only governance guards by default.

They may inspect across domains and return findings/gate status. They do not dispatch Villagers or edit production code to make a gate pass.

Instantiate only Wardens relevant to the changed contract.

`warden-quality` is required for meaningful behavioral changes before asking the human to consider Ready for Review.

## Taskmaster

Use a Taskmaster when one bounded domain naturally contains several subtasks needing consolidation.

The Taskmaster may invoke Villagers but may not:

- redefine objective/scope;
- make new product/architecture/persistence/security/provider decisions;
- perform Git lifecycle work;
- create another Taskmaster layer;
- certify acceptance.

Maximum execution hierarchy:

`Chieftain -> Taskmaster -> Villager`

## Villagers

Villagers execute exact bounded assignments.

They do not:

- decide what work should exist;
- broaden scope;
- opportunistically refactor unrelated code;
- make protected decisions;
- perform Git lifecycle work;
- invoke other agents;
- run broad suites unless explicitly requested.

Out-of-scope findings are reported, not pursued.

## Delegation packet

Use:

```text
ROLE:
GOAL:
SCOPE:
INPUT REFS:
DO:
DO NOT:
FOCUSED CHECK:
RETURN:
```

Send the minimum context required for the task.

## Model routing

Follow `village.config.yml`.

Default starter policy:

- deny Anthropic/Claude;
- deny unknown routes that may resolve to a forbidden provider;
- select the least expensive capable approved model;
- strongest models for Chieftain-level ambiguity and consequential synthesis;
- medium models for Taskmaster decomposition;
- cheapest capable models for Villager execution;
- child agents never self-escalate model cost;
- prefer independent reviewer model diversity when practical.

Agent profiles intentionally do not pin exact model product names.

## Validation and test quality

Green CI is not a completion argument.

For meaningful changes, the Chieftain must state:

- behavior changed;
- behavior preserved;
- happy path;
- foreseeable failures/rejections;
- boundaries;
- graceful degradation;
- regression/invariants;
- test evidence;
- E2E impact;
- known untested risk.

The Quality Warden must challenge whether the verification would actually fail for a meaningful regression.

Do not weaken or skip meaningful tests merely to obtain green CI.

## E2E

Treat E2E as a small product-journey contract, not a browser-shaped unit-test suite.

Prefer:

- local logic -> unit;
- module/service contracts -> integration/contract;
- critical cross-boundary journeys -> E2E;
- provider/network behavior -> focused integration unless browser behavior is itself the contract.

## Git and PR lifecycle

Only the Chieftain performs Git lifecycle operations for delegated work.

All agent-authored PRs open as Draft.

Normal flow:

```text
Shaman Gate 0
-> Shaman Gate 1
-> Chieftain plan
-> Taskmaster/Villagers
-> relevant Wardens
-> Shaman Gate 2
-> human Ready-for-Review decision
-> full PR CI/E2E
-> human merge decision
```

At Epic completion add Shaman Gate 3.

Agents must not mark a PR Ready for Review unless the human explicitly instructs that exact transition.

## Provenance

Maintain the PR traceability template. If the increment cannot show requirement -> decision -> implementation -> verification -> independent gate -> CI -> human decision lineage, it is not complete.

## Investigation-only work

When the task is investigation-only, do not implement discovered fixes. Report evidence and let the Chieftain/human decide what becomes subsequent work.
