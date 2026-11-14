# Prepare transfer to Kobold Technologies

Status: preparation only. No ownership transfer has been requested or performed.
The exact destination organization slug and receiving owner/team must be confirmed
by the maintainer before transfer.

## Current baseline

- Source: `svdb-hotmail/sunstrucksynapse.com`; default branch: `main`; visibility: public.
- PR #101 and #102 are merged, with the pre-MVP CI gate and separate security checks.
- There are older open stacked PRs. Inventory their base/head branches before transfer;
  do not merge or close them as part of migration preparation.
- The current `LICENSE` reserves all rights. Organization ownership does not grant
  a new software license or transfer third-party music/artwork rights.
- Outstanding administrator settings are listed in
  [GitHub repository settings](github-repository-settings.md).

## Before transferring

1. Confirm the destination organization slug, owner authority, plan, and 2FA policy.
   Check for a conflicting repository name and preserve public visibility unless
   the maintainer separately requests a change.
2. Finish security settings and verify a protected-branch PR can pass `quality-gate`
   and CodeQL. Record the final source commit, open PRs/issues, rulesets, collaborator
   permissions, teams, releases, tags, and deployment settings without secret values.
3. Install/authorize the required GitHub Apps for the destination organization:
   Cloudflare deployments/previews, coding integrations, and any repository-specific
   apps. Confirm their access to the transferred repository before relying on them.
4. Review Actions permissions, organization runner policy, Dependabot, code scanning,
   secret scanning, and push protection under destination organization policy.
5. Inventory Actions/environment secrets and variables, deploy keys, webhooks, and
   external tokens with the owner. Do not copy values into migration documentation.
   Confirm what GitHub preserves for the chosen transfer path and which organization
   secrets need the repository added to their access policy.
6. Confirm Cloudflare Worker build integration, the separate curator preview Pages
   integration, and their GitHub repository authorization. The application also uses
   Cloudflare Access, R2, and an external database. Moving the GitHub repository does
   not transfer these accounts, media assets, DNS, or billing.
7. Confirm the receiving maintainer/team before adding CODEOWNERS. Grant only the
   access needed and verify the original owner retains any required transition access.
8. Keep `sunstrucksynapse.com` and the intended `sunsyn.art` platform-domain transition
   separate from this repository ownership change. See [Deployment](deployment.md).

## Transfer and verification (separate owner-authorized step)

The owner performs the transfer only after confirming the destination and accepting
its organization policies. Do not delete and recreate the repository.

After transfer:

- Verify repository visibility, `main`, branches/tags, history, issues, PRs, releases,
  collaborators/teams, rulesets, and enabled security features.
- Update local remotes and current source references, including `village.config.yml`,
  security-report links in `SECURITY.md`, CI badges if added, integration settings,
  and any active documentation links. Preserve historical evidence where appropriate.
- Re-authorize Cloudflare and other GitHub Apps; verify preview and production build
  triggers against the new owner/repository identity, coordinating any deployment
  with the owner. Update OIDC subject rules if any integration relies on them.
- Run the pre-MVP CI gate and security checks; verify Dependabot recognizes its
  configuration and the private vulnerability reporting form is available.
- Record the new URL, final commit, verification results, and any unresolved follow-up.
  GitHub redirects are useful compatibility, not a replacement for updating integrations.

Do not assume reversing a transfer is immediate or unrestricted. Resolve a failed
integration with the destination owner rather than deleting repository history.
