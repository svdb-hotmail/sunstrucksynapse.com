# Contributing

SunSyn Radio is pre-MVP. Keep changes focused and agree on product or security
behavior with the maintainer when it is ambiguous. The repository currently
reserves all rights; this document does not grant a software license.

## Local checks

Use Node.js 22.22.0 and install FFmpeg for the encoder tests:

```bash
npm ci --no-audit --no-fund
npm run ci
```

The gate checks formatting, lint, TypeScript, unit/contract tests, encoder tests,
local database validation, and the production build. It does not require live
production credentials. See [README](README.md#quality-gates) for optional manual
browser and preview checks while the design evolves.

## Pull requests

Explain the change and validation, and flag unresolved design questions. The
`quality-gate` check and security job run for non-draft PRs, including stacked
PRs. For a stack, merge its base PR first, retarget the child to `main`, and check
its status before merging. Retain merge commits when preserving the ancestry of
an active stack. Do not treat a preview deployment as proof that CI passed.

Report vulnerabilities using [SECURITY.md](SECURITY.md), with no public exploit
or private data. Keep deployment secrets and private media out of changes.
