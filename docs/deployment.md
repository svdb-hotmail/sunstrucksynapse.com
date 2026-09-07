# Deployment

The application targets Cloudflare Workers through React Router framework mode and the Cloudflare Vite plugin, as recorded in [ADR 0002](architecture/decisions/0002-cloudflare-workers-runtime.md).

Cloudflare account setup, custom-domain changes, and secret values remain operator-managed and are not stored in the repository. The repository contains the Worker name and runtime resource bindings required by Wrangler, but no account identifier or secret values.

The intended SunSyn Radio public domain remains `sunsyn.art`. The currently verified operational domain is `sunstrucksynapse.com`, retained for the existing Sunstruck Synapse catalogue identity until the platform-domain transition is separately authorized and completed.

## Verified production deployment

On 2026-09-04, the production application was verified on the Cloudflare Worker named `sunstruck-synapse-radio`:

- the Worker build and deployment from the `main` branch completed successfully;
- `sunstrucksynapse.com` served the React Router application through the Worker;
- `www.sunstrucksynapse.com` redirected to the apex domain;
- the required runtime bindings and secrets were present in Cloudflare; and
- automatic production and preview deployments were disabled on the obsolete `sunstrucksynapse-com` Pages project so it no longer competes with the Worker deployment.

The Cloudflare dashboard remains the source of truth for account-side routes, build triggers, bindings, and secrets. A green repository check alone does not establish that the public route is healthy; verify the deployed domain after each production deployment.

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

`wrangler.jsonc` declares the source Worker entry without account-specific values. The Cloudflare Vite plugin produces the deployable client and Worker output under `build/`, including the generated Worker build configuration. The account-side build trigger deploys that output from `main`; verify the final domain separately after each deployment.

## Disabled legacy Pages project

The Cloudflare account retains a legacy `sunstrucksynapse-com` Pages project for deployment history, but its automatic production and preview deployments were disabled on 2026-09-04. It is not the production deployment target.

For commit `83159576d506cbc89e1dce2c71fa5c39ff87f11a`, the former GitHub integration reported a successful deployment and advertised these previews:

- `https://406d0077.sunstrucksynapse-com.pages.dev/`
- `https://phase-0-15-typescript-applic.sunstrucksynapse-com.pages.dev/`

On 2026-08-14, HTTP GET requests to `/` on both URLs returned `404` with an empty response body. A green Pages check therefore confirms only that the legacy integration completed its upload/deployment workflow; it is not proof that the React Router application is healthy or being served.

The repository configuration confirms that the application requires React Router server-side rendering through the Worker entry in `workers/app.ts`. Its production build contains separate client assets and a Worker server bundle rather than a standalone static `index.html`. The exact Pages build command, output directory, and deployment logs are not available through the repository or GitHub check metadata; the check links to an authenticated Cloudflare dashboard. The available evidence is therefore consistent with, but does not by itself prove, a legacy static Pages configuration that does not execute the Worker SSR entry.

The Pages URLs must not be treated as working application previews. Production is deployed through the Worker build trigger, which runs `npm run build` and `npx wrangler deploy` from `main`; `npm run dev` and `npm run preview` remain the valid local Cloudflare Workers runtime checks.
