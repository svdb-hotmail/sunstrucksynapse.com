# Configure this GitHub repository

Repository: `svdb-hotmail/sunstrucksynapse.com`. Instructions updated 2026-11-14.
Open the links below in your own browser while signed in as the repository owner.
The cloud GitHub connection returns HTTP 403 for administrator settings, so the
settings below have not been applied by the agent.

## 1. Merge the repository configuration files

Open [PR #103](https://github.com/svdb-hotmail/sunstrucksynapse.com/pull/103).

1. Review the changes under **Files changed**.
2. Return to **Conversation** and click **Ready for review**.
3. Wait for `quality-gate`, `security`, and CodeQL to pass. Browser journeys are
   excluded from this pre-MVP CI.
4. Resolve any reported blocking review conversations.
5. Click **Merge pull request**, then **Confirm merge**.

After merging, open `.github/dependabot.yml`, `SECURITY.md`, and `CONTRIBUTING.md`
on the `main` branch to confirm the files are present. The weekly grouped
Dependabot configuration and policy files are only prepared in the PR until it
merges. Committed JSON under `.github/repository-settings/` is a settings proposal;
it does not automatically change GitHub settings.

PRs #101 and #102 are already merged. The simplified CI is already active on `main`.

## 2. Enable dependency and secret protection

Open [repository security settings](https://github.com/svdb-hotmail/sunstrucksynapse.com/settings/security_analysis).
GitHub may redirect this link to its current **Code security**, **Secret protection**,
or **Advanced Security** settings page. Use the named feature rows below; GitHub's
sidebar grouping can change.

| Feature row                               | Action                        | Verify                               |
| ----------------------------------------- | ----------------------------- | ------------------------------------ |
| **Dependency graph**                      | Click **Enable** if disabled. | Enabled; the row offers **Disable**. |
| **Dependabot alerts**                     | Click **Enable** if disabled. | Enabled; the row offers **Disable**. |
| **Dependabot security updates**           | Click **Enable** if disabled. | Enabled; the row offers **Disable**. |
| **Secret scanning**                       | Click **Enable** if disabled. | Enabled; the row offers **Disable**. |
| **Push protection** under secret scanning | Click **Enable** if disabled. | Enabled; the row offers **Disable**. |

Confirm an enable action if GitHub opens a confirmation dialog. If a feature is
already enabled, leave it enabled. Use the features available for this public
repository; stop at any purchase/trial prompt rather than subscribing.

Verify the result in the [Security overview](https://github.com/svdb-hotmail/sunstrucksynapse.com/security):

- Open **Dependabot** to see its enabled alert view. Existing alerts may remain;
  enabling the feature does not fix dependencies automatically.
- Open **Secret scanning** to see its enabled alert view.
- Open **Code scanning** to see the existing CodeQL results from CI. CodeQL already
  uses `.github/workflows/ci.yml`; retain that advanced setup. Its scan identity
  was corrected and its checks passed on merged `main`.

Private vulnerability reporting and the monitored security contact are deferred
until after transfer to Kobold Technologies, as requested by the maintainer.

## 3. Require PRs and the existing quality gate on main

Open [Rulesets](https://github.com/svdb-hotmail/sunstrucksynapse.com/settings/rules).
Click the existing **Copilot review for default branch** ruleset (ID `21111453`),
then **Edit** if GitHub shows a read-only view. Its direct settings link is
[edit ruleset 21111453](https://github.com/svdb-hotmail/sunstrucksynapse.com/settings/rules/21111453).

1. Rename it to **Pre-MVP main protections**.
2. Keep **Enforcement status** set to **Active**.
3. Under **Target branches**, retain the **default branch** target. This follows
   `main` without applying the rule to every development branch.
4. Leave the bypass list empty.
5. Preserve the existing **Restrict deletions**, **Block force pushes**, Copilot
   review, CodeQL/code-scanning, and code-quality settings.
6. Select **Require a pull request before merging**. Set **Required approvals** to
   **0** for solo pre-MVP development. Enable **Require conversation resolution
   before merging**. Leave mandatory code-owner reviews, last-push approval, and
   stale-review dismissal disabled.
7. Select **Require status checks to pass**. Click **Add checks** and search for
   **quality-gate**. Select the check produced by **GitHub Actions** (app ID `15368`)
   by this repository's **CI** workflow. GitHub may display it as
   **CI / quality-gate**; the API context is `quality-gate`.
8. Leave **Require branches to be up to date before merging** unchecked.
9. Click **Save changes** or **Save**, then reopen the ruleset to verify the values.

If `quality-gate` is absent from the check selector, first confirm a recent
successful run of the **CI** workflow in [Actions](https://github.com/svdb-hotmail/sunstrucksynapse.com/actions/workflows/ci.yml),
then reopen the editor. Do not substitute a Cloudflare preview check.

This configuration requires a PR and passing code/build validation, with zero
mandatory human approvals. It does not require browser journeys, deployment
approvals, or a merge queue. Existing scan protections remain enabled.

The reviewed API equivalent is
[main-ruleset.json](../.github/repository-settings/main-ruleset.json).

## 4. Set Actions token and outside-contributor defaults

Open [Settings → Actions → General](https://github.com/svdb-hotmail/sunstrucksynapse.com/settings/actions).

1. Find **Workflow permissions** near the bottom.
2. Select **Read repository contents and packages permissions**.
3. Leave **Allow GitHub Actions to create and approve pull requests** unchecked.
4. Click **Save** for this section.
5. Find **Approval for running fork pull request workflows from contributors**.
6. Select **Require approval for all outside collaborators** (some UI versions say
   outside contributors).
7. Click **Save** for that section.
8. Reload the page and confirm both selections persisted.

The CI workflow explicitly grants its security job the permissions CodeQL needs;
the repository-wide default can remain read-only. Keep the current allowed-actions
policy unchanged unless it blocks a specific action used by this repository.
If the organization later locks these controls, its owner must configure the
organization policy instead.

## 5. Configure private reports after the ownership migration

Destination: [Kobold-Technologies](https://github.com/Kobold-Technologies).
No ownership transfer has been performed. Use the separate
[owner-migration checklist](kobold-technologies-owner-migration.md) before transferring.

After the transfer:

1. Open `https://github.com/Kobold-Technologies/sunstrucksynapse.com/settings/security_analysis`.
2. Find **Private vulnerability reporting** and click **Enable**. GitHub may group
   this row under repository security or Advanced Security.
3. Configure and confirm a monitored private security contact for Kobold Technologies.
4. Update `SECURITY.md` with the actual reporting channel/contact and the new owner URL.
5. Open `https://github.com/Kobold-Technologies/sunstrucksynapse.com/security` and verify
   **Report a vulnerability** is available. Open the form without submitting a test report.
6. Recheck dependency/secret protection, Actions settings, rulesets, CodeQL, and
   GitHub App access under the destination organization's policies.

## Completion checklist

- [ ] PR #103 merged; policy and Dependabot configuration files exist on `main`.
- [ ] Dependency graph, Dependabot alerts, and security updates enabled.
- [ ] Secret scanning and push protection enabled.
- [ ] Existing CodeQL advanced setup reports successful results.
- [ ] Active default-branch ruleset requires PRs and the GitHub Actions `quality-gate` check.
- [ ] Required approvals is zero; strict branch freshness is off.
- [ ] Existing deletion, force-push, scanning, and code-quality protections preserved.
- [ ] Actions defaults are read-only; outside-contributor fork workflows need approval.
- [ ] Post-migration private reporting/contact setup remains explicitly pending.

The current license, wiki, projects, merge methods, deployment accounts, domains,
and ownership are unchanged by these instructions.
