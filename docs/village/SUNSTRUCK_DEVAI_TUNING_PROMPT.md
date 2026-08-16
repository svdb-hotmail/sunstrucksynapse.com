# DevAI prompt - tune the Village for Sunstruck Synapse Radio

```text
Tune the Kobold Village installation on the current Draft governance PR for `svdb-hotmail/sunstrucksynapse.com`.

First inspect the repository, its GitHub Epic/issue graph, product scope, ADRs, database/media/security boundaries, package scripts, Playwright setup, current CI, and all Village files. Classify the tuning work itself as Epic-linked or N/A. Determine the active product Epic from phase order, parent/child state, merged delivery evidence, and repository sources rather than assuming it from issue number or open state. Where relevant, compare it with the previous and next Epic so inherited constraints and downstream contracts are explicit.

Before editing, give me one consolidated list of material questions where a good outcome currently depends on ambiguity, subjective/non-measurable acceptance criteria, unclear sequencing, contradictory docs/issues, or unresolved product, editorial, rights/provenance, architecture, storage, auth/security, or private-media decisions. For each, show the evidence, consequence, bounded options, and your recommendation. Do not treat a recommendation or my silence as approval.

After I answer, make only the necessary repository-specific adjustments. Preserve Shaman Gate 0, independent acceptance, relevant Wardens, bounded Villager execution, human-only Draft -> Ready and merge authority, and least-expensive-capable non-Anthropic model routing unless I explicitly change them.

Preserve the existing `CI / quality-gate` contract while ensuring comprehensive PR CI is skipped while Draft and runs on Ready-for-Review plus later Ready synchronizations. Keep the post-merge `main` quality gate unless there is a concrete reason to change it.

Keep the PR Draft. Finish with: changes made; human decisions recorded; roles kept/removed; CI/E2E contract; remaining ambiguity/risk; and `READY FOR HUMAN TO CONSIDER REVIEW | NOT READY | BLOCKED`.
```
