# Launch dependency triage

12 October 2026. Separate from L1–L3 behavior verification. No claim that PR #83 resolves
all alerts. GitHub's handoff count was ten; the fresh npm audit of the actual lockfile
reports 23 vulnerable package nodes (2 critical, 16 high, 5 moderate). These are different
measurements and cannot be equated to 23 distinct GitHub alerts.

All affected package nodes are development tooling; no direct imports of undici,
tinypool, mocker or esbuild were found in `app/` or `workers/`. Development scope alone
does not establish unreachability or justify passing `npm audit --audit-level=high`.
The existing broad CI audit currently remains a blocker.

| Actual dependency path                                               | Exposure / remaining work                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Vite plugin / Wrangler → Miniflare → undici 7.29.0        | Preview makes outbound HTTP requests, so network handling is reachable in tooling. Undici advisories include TLS BalancedPool configuration loss. No BalancedPool use was found in the bundled Miniflare; ordinary Pool is used. Patch provider-supported tooling/Undici; do not infer safety for every interceptor/WebSocket path. |
| Vitest 3.2.7 → @vitest/mocker 3.2.7                                  | Redirect-mock file-read advisory is still reported despite the earlier isolated mocker PR. Test runner uses `vitest run`, not a public mock server. Requires a coherent supported Vitest/mocker patch; no unreviewed major test-framework upgrade in launch branches.                                                               |
| Vitest → tinypool                                                    | Current audit reports critical prototype-pollution/RCE advisories through worker options. Tests are repository-authored, but this is not a general unreachability proof. Review a compatible patch and runner behavior separately.                                                                                                  |
| drizzle-kit → @esbuild-kit/esm-loader → core-utils → esbuild 0.18.20 | Vulnerable development-server API remains in migration tooling; drizzle-kit also uses esbuild 0.25.12. The ordinary migration runtime is separate. Do not downgrade drizzle-kit to npm audit's surprising proposed 0.18.1 fix.                                                                                                      |
| Vite/Storybook/tsx/Wrangler → esbuild 0.28.1                         | This resolved version is outside the reported ≤0.24.2 server advisory; it does not fix the older nested copy above.                                                                                                                                                                                                                 |
| typescript-eslint 8.42.0 → fast-glob/micromatch/braces               | Lint file discovery uses this path. New audit reports high-severity pattern-recursion advisories; update compatible tooling and verify lint.                                                                                                                                                                                        |
| sharp 0.35.4 override; source-map-js; brace-expansion                | New audit reports additional high findings not represented by the handoff summary. Review the actual consumers and compatible patched versions.                                                                                                                                                                                     |

Source advisories include GHSA-w293-vg96-wgc3 (Undici), GHSA-82fw-gwwq-j7x9
(Vitest/mocker), GHSA-5gmw-xhrv-c9v3 and GHSA-85c8-ppgw-ccpr (Tinypool),
GHSA-67mh-4wv8-2f99 (esbuild), GHSA-vfj7-8cjw-p6xm (braces),
GHSA-wq5f-xc86-pv6w (sharp), and GHSA-68fv-2mgg-jv7q (source-map-js).
The fresh npm advisory service supplied these findings; no runtime exploit is asserted.
Dependency fixes should remain separately reviewable and must not suppress audit checks.
