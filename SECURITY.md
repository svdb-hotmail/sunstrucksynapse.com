# Security policy

## Supported versions

SunSyn Radio is pre-MVP. Security fixes target the current `main` branch; there
are no supported stable release lines yet. Browser journeys and visual design
are still evolving and are reviewed manually.

## Report a vulnerability privately

Use this repository's [private vulnerability reporting form](https://github.com/svdb-hotmail/sunstrucksynapse.com/security/advisories/new).
This channel requires the owner to enable private vulnerability reporting in
GitHub Settings → Security. If the form is unavailable, open an issue asking the
maintainer for a private reporting channel **without including vulnerability
details**. Do not post exploit code, credentials, private media, signed playback
URLs, personal information, or database contents in public issues or PRs.

Include the affected commit or route, reproducible steps using synthetic data,
expected and observed behavior, and the potential impact. Redact secrets and
personal data. Focus on authentication, curator authorization, private media,
uploads, signed delivery, data exposure, and dependencies. Do not access another
person's data or disrupt deployed services while reproducing a report.

## Repository checks

Automatic CI checks code quality, types, unit/contract tests, the encoder, local
database validation, and the production build. Dependency auditing and CodeQL
run in parallel. These checks do not certify product journeys or production
readiness. Credentials belong in the relevant secret store, never in source,
fixtures, screenshots, logs, or issue bodies. Revoke exposed credentials before
removing their committed copies; deleting a file does not remove Git history.
