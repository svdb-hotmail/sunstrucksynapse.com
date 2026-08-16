# Kobold Village custom agents

`AGENTS.md` and `VILLAGE_CHARTER.md` are the canonical operating contracts. These profiles instantiate the Village roles with bounded tool access and invocation behavior.

| Profile               | Purpose                                             | Human selectable |
| --------------------- | --------------------------------------------------- | ---------------: |
| `chieftain`           | technical delivery, integration, Git/PR ownership   |              yes |
| `shaman`              | Gate 0/1/2/3, requirement continuity and acceptance |              yes |
| `elder-wisdom`        | long-range product/architecture challenge           |              yes |
| `elder-doubt`         | adversarial assumptions/failure-mode challenge      |              yes |
| `warden-quality`      | verification and E2E quality                        |              yes |
| `warden-architecture` | architecture boundaries                             |              yes |
| `warden-security`     | auth/privacy/security boundaries                    |              yes |
| `warden-canon-data`   | schema, persistence, lineage, migrations            |              yes |
| `taskmaster`          | bounded decomposition and Villager dispatch         |               no |
| `villager*`           | bounded craft execution                             |               no |

Exact model names are intentionally not pinned. Follow `village.config.yml`: least expensive capable approved model, no child self-escalation, no Claude/Anthropic, and no unknown route that may resolve to a forbidden provider.

Governance may challenge sideways or upward. Execution authority is always
`Chieftain -> Taskmaster -> Villager`; direct Chieftain -> Villager delegation
is forbidden. One Taskmaster receives one admitted ticket and splits it into
small, specialized Villager packets. Villagers never run validation commands.
