# Kobold Village Copilot instructions

Read repository-root `AGENTS.md` first and obey its workflow selector. When Direct Mode has been explicitly activated under that selector, the Kobold-specific instructions below do not apply; continue to follow the security requirement in this file.

Otherwise, read and follow `VILLAGE_CHARTER.md` and `village.config.yml` before substantive work.

Use the exact repository custom-agent profiles under `.github/agents/` when their role is required. Do not replace an available Shaman, Warden, Elder, Taskmaster, or Villager gate with informal role-play in the Chieftain context.

For Epic-linked work, Shaman Gate 0 must happen before substantive implementation. Material ambiguity is escalated to the human maintainer rather than converted into assumptions.

Keep PRs Draft until the human maintainer explicitly decides they are Ready for Review.

Use focused checks during iteration. Full repository validation belongs to the Ready-for-Review PR workflow.

Never expose credentials, signed URLs, private media, secrets, or full sensitive project snapshots in prompts/logs.
