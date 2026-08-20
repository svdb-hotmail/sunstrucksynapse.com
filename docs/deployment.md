# Deployment

The application targets Cloudflare Workers through React Router framework mode and the Cloudflare Vite plugin, as recorded in [ADR 0002](architecture/decisions/0002-cloudflare-workers-runtime.md).

Production deployment, account setup, custom-domain changes, and secrets are intentionally outside the current application migration. The repository contains no Cloudflare account or resource identifiers.

## Manual Phase 2 prerequisites

Before deployment, an operator must:

1. Create the production `sunstruck-synapse-media` and preview `sunstruck-synapse-media-preview` R2 buckets.
2. In the Cloudflare Worker dashboard, configure the `MEDIA_BUCKET` R2 binding and the `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `CURATOR_EMAILS` runtime variables. These values are intentionally not stored in `wrangler.jsonc`.
3. In the Cloudflare Worker dashboard, configure `DATABASE_URL` and a high-entropy `MEDIA_DELIVERY_SIGNING_SECRET` as secrets. Do not commit their values.
4. Apply every committed migration through `0008_lame_guardian.sql` before deploying.
5. Verify Access rejection and signed media byte-range delivery.

The configuration retains the `MEDIA_BUCKET` binding and bucket names for deployment consistency, but Cloudflare supplies the actual runtime binding and values. It does not create Access policies, buckets, DNS, or secrets.

## Build boundary

Use Node.js 22.22 or later:

```bash
npm ci
npm run typecheck
npm run build
npm run preview
```

`wrangler.jsonc` declares the source Worker entry without account-specific values. The Cloudflare Vite plugin produces the deployable client and Worker output under `build/`, including the generated Worker build configuration. A later deployment change must define the production workflow and verify the final domain separately.

## Legacy Pages preview limitation

The repository still has a legacy Cloudflare Pages GitHub integration. For commit `83159576d506cbc89e1dce2c71fa5c39ff87f11a`, its GitHub check reported a successful deployment and advertised these previews:

- `https://406d0077.sunstrucksynapse-com.pages.dev/`
- `https://phase-0-15-typescript-applic.sunstrucksynapse-com.pages.dev/`

On 2026-08-14, HTTP GET requests to `/` on both URLs returned `404` with an empty response body. A green Pages check therefore confirms only that the legacy integration completed its upload/deployment workflow; it is not proof that the React Router application is healthy or being served.

The repository configuration confirms that the application requires React Router server-side rendering through the Worker entry in `workers/app.ts`. Its production build contains separate client assets and a Worker server bundle rather than a standalone static `index.html`. The exact Pages build command, output directory, and deployment logs are not available through the repository or GitHub check metadata; the check links to an authenticated Cloudflare dashboard. The available evidence is therefore consistent with, but does not by itself prove, a legacy static Pages configuration that does not execute the Worker SSR entry.

The Pages project must eventually be migrated or replaced with an intentional Workers deployment configuration that publishes both the Worker entry and its client assets. Until that separate account migration is planned and verified, `npm run dev` and `npm run preview` remain the valid local Cloudflare Workers runtime checks, and the legacy Pages URLs must not be treated as working application previews.
