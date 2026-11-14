# GitHub repository settings

Audit date: 2026-11-14. Repository: `svdb-hotmail/sunstrucksynapse.com` (public).
This document records desired settings; committed JSON does not apply them automatically.

## Applied through the repository

- `CI / quality-gate`: visible formatting, lint, type, unit/contract, database,
  production-build, and encoder steps, with a ten-minute timeout.
- Parallel dependency auditing and CodeQL, retaining the existing CodeQL analysis
  identity expected by the repository's code-scanning rule.
- Validation on stacked PRs as well as PRs targeting `main`.
- No automatic browser journeys, compatibility suites, Storybook, or exact visual
  baselines during pre-MVP design. These remain manually available.
- Weekly grouped npm and GitHub Actions updates in `.github/dependabot.yml`.
- A root security policy and contribution instructions.

## Administrator settings still required

The connected GitHub integration returned HTTP 403 for all attempted settings
writes, despite the repository metadata reporting account administrator access.
Account permissions and integration permissions are separate. Do not interpret
these failures as settings having been applied.

| Setting                                 | Observed                    | Desired                                                            |
| --------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| Private vulnerability reporting         | Disabled                    | Enabled                                                            |
| Dependabot alerts                       | Integration cannot inspect  | Enabled                                                            |
| Dependabot security updates             | Integration cannot inspect  | Enabled                                                            |
| Secret scanning                         | Integration cannot inspect  | Enabled                                                            |
| Secret-scanning push protection         | Integration cannot inspect  | Enabled                                                            |
| Main deletion and force-push prevention | Enabled in ruleset 21111453 | Preserve                                                           |
| CodeQL and code-quality rules           | Enabled in ruleset 21111453 | Preserve                                                           |
| Pull requests required                  | Absent from that ruleset    | Required; zero mandatory approvals for solo pre-MVP work           |
| Required `quality-gate` check           | Absent from that ruleset    | Required; no strict up-to-date requirement                         |
| Actions defaults and fork approvals     | Integration cannot inspect  | Read-only default token; require approval for outside contributors |

Use an administrator-authorized GitHub session to review Settings → Security,
Settings → Rules → Rulesets, and Settings → Actions → General. Do not enable paid
GitHub security products as part of this setup. Public-repository secret scanning
and push protection should be used where available.

The exact proposed ruleset preserves existing rules and adds PRs, resolved review
threads, and the existing `quality-gate` check. It does not require a second human
reviewer, enforce a deployment environment, or add browser journey checks.
With an appropriately authorized `gh` session, apply the reviewed configuration:

```bash
gh api --method PUT repos/svdb-hotmail/sunstrucksynapse.com/private-vulnerability-reporting
gh api --method PUT repos/svdb-hotmail/sunstrucksynapse.com/vulnerability-alerts
gh api --method PUT repos/svdb-hotmail/sunstrucksynapse.com/automated-security-fixes
gh api --method PATCH repos/svdb-hotmail/sunstrucksynapse.com \
  --input .github/repository-settings/security-and-analysis.json
gh api --method PUT repos/svdb-hotmail/sunstrucksynapse.com/rulesets/21111453 \
  --input .github/repository-settings/main-ruleset.json
```

Re-read the current ruleset before applying its snapshot if other settings have
changed. Verify each feature and the ruleset after applying it. This payload is
for the current repository; re-audit identifiers and organization policy after
an ownership transfer. Updating Actions defaults needs owner access in the UI.

Do not disable branch deletion, force-push, or code-scanning safeguards to work
around a failing check. Existing wiki, projects, merge methods, and the current
all-rights-reserved license are left for explicit owner decisions.
