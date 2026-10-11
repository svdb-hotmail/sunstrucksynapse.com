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
- Framework, providers, React, React Router, Vitest, database schema and production
  configuration are unchanged. No audit exclusion or test suppression.

Fresh audit of the launch baseline: 23 vulnerable package nodes, 2 critical / 16 high /
5 moderate. Fresh audit of this patched lockfile: 7 nodes, 2 critical / 0 high / 5 moderate.
Package-node counts are not the handoff's GitHub-alert count. This is partial remediation,
not a statement that all dependencies are safe or all GitHub alerts are closed.

`npm ci`, strict type generation/TypeScript, repository ESLint and production Worker/client
build passed. 18 focused media-service and 13 playback-coordinator tests passed using the
patched installation. The final brace-expansion patch received focused lint verification.
Broad CI remains Draft-gated. No production deployment or browser execution is claimed.

## Remaining launch gate

The normal `npm audit --audit-level=high` still fails because it includes the critical
Vitest/Tinypool findings. Do not bypass it or exclude development dependencies to get green.

- Vitest 3.2.7 / nested mocker 3.2.7: mock redirect file-read advisory remains; npm reports
  a coherent newer major framework as the available fix.
- Tinypool 1.1.1: prototype-pollution/RCE worker-options advisories remain. Do not force a
  newer major worker-pool API into Vitest's 1.x range without reviewing compatibility.
- drizzle-kit's legacy loader → esbuild 0.18.20 development-server advisory remains moderate.
  Do not accept npm audit's suggested downgrade of drizzle-kit to 0.18.1.

The Worker does not import these development tools, but test/build environments do use
them. The current fixed repository-authored tests do not establish general unreachability.
The remaining coherent runner update and migration-tooling patch must be reviewed and
validated separately before asserting a green full quality gate. No major test-framework
upgrade was applied silently as part of the launch implementation.
