# Compatible launch tooling patches

12 October 2026. Separate maintenance increment based on main `35aa502`, alongside
launch PRs #85–#87. The maintainer-authorized SOLO exception applies; no independent
Village review or acceptance is claimed. This PR remains Draft.

## Changes and evidence

- Cloudflare Vite plugin 1.52.1 → 1.63.1 and Wrangler 4.123.0 → 4.149.0.
  Their resolved Miniflare dependency now uses Undici 7.29.1; the reported Undici
  advisories no longer appear in the fresh npm audit.
- typescript-eslint 8.42.0 → 8.71.1, preserving the same major.
- Patch overrides: sharp 0.35.5, source-map-js 1.2.2 and compatible brace-expansion
  1.1.21 / 2.1.7 / 5.0.12 ranges. No package with a different major is forced into
  these dependency ranges. The 5.x patch closes the remaining nested 5.0.9 finding.
- Framework, providers, React, React Router, database schema and production
  configuration are unchanged. No audit exclusion or test suppression.

Fresh audit of the launch baseline: 23 vulnerable package nodes, 2 critical / 16 high /
5 moderate. Fresh audit of this patched lockfile: 7 nodes, 2 critical / 0 high / 5 moderate.
Package-node counts are not the handoff's GitHub-alert count. This is partial remediation,
not a statement that all dependencies are safe or all GitHub alerts are closed.

`npm ci`, strict type generation/TypeScript, repository ESLint and production Worker/client
build passed. 18 focused media-service and 13 playback-coordinator tests passed using the
patched installation. The final brace-expansion patch received focused lint verification.
Broad CI remains Draft-gated. No production deployment or browser execution is claimed.

## Coherent test runner remediation

Vitest is explicitly upgraded from 3.2.7 to 4.1.11 in this separate Draft maintenance PR. The coherent runner dependency set removes the vulnerable Tinypool path and updates the mocker, rather than forcing an incompatible worker-pool override. This is a major tooling change requiring maintainer review; the application framework and deployment remain unchanged.

The final audit reports **0 critical, 0 high, 4 moderate package nodes**, and `npm audit --audit-level=high` passes. The four moderate nodes belong to drizzle-kit's legacy esbuild loader chain. No audit exclusions or suggested drizzle-kit downgrade were applied. The production-only audit remains zero findings. GitHub alert closure is not inferred from a local audit.

Focused runner compatibility: six workflow repository tests and 31 media/playback tests pass with Vitest 4.1.11; strict TypeScript passes. Broad CI remains Draft-gated, and the major runner upgrade is explicitly reviewable here.
