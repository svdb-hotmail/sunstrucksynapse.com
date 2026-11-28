# Deployment

The application targets Cloudflare Workers through React Router framework mode and the Cloudflare Vite plugin, as recorded in [ADR 0002](architecture/decisions/0002-cloudflare-workers-runtime.md).

Cloudflare account setup, custom-domain changes, and secret values remain operator-managed. The repository contains the Worker name, account identifier, non-secret R2 bucket name, and runtime resource bindings required by Wrangler; credential values are never stored in the repository.

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
4. To enable browser-to-R2 private review-audio uploads, create an R2 API token limited to
   object read/write for the bound media bucket. Configure `R2_ACCESS_KEY_ID` and
   `R2_SECRET_ACCESS_KEY` as Worker secrets. `R2_ACCOUNT_ID` and the production
   `R2_BUCKET_NAME` are non-secret Wrangler variables; override the bucket name locally for
   preview work. The application fails closed when this set is absent or incomplete.
5. Configure R2 CORS for the submission origin. Permit `PUT`, permit the `Content-Type`,
   `x-amz-meta-checksum-sha256`, and `x-amz-meta-upload-session-id` request headers, and expose
   `ETag`. Scope `AllowedOrigins` to the real submission origins rather than `*`.
6. Keep the enabled `Review audio staging cleanup` lifecycle rule on both media buckets. It
   expires only the `private/review-audio/staging/` prefix after 24 hours; the scheduled outbox
   performs normal cleanup when the 15-minute upload URL expires.
7. Apply every committed migration through `0012_audit_submission_invitations.sql` before deploying.
8. Verify Access rejection, curator review-audio byte-range delivery, and the scheduled outbox
   dispatcher.

The configuration retains the `MEDIA_BUCKET` binding and bucket names for deployment consistency, but Cloudflare supplies the actual runtime binding and values. It does not create Access policies, buckets, DNS, or secrets.

## Build boundary

Use Node.js 22.22 or later:

```bash
npm ci
npm run typecheck
npm run build
npm run preview
```

After changing `wrangler.jsonc`, run `npm run typegen` and commit the generated
`worker-configuration.d.ts`. The Cloudflare Vite plugin produces the deployable client and Worker
output under `build/`, including the generated Worker build configuration. The account-side build
trigger deploys that output from `main`; verify the final domain separately after each deployment.

## Disabled legacy Pages project

The Cloudflare account retains a legacy `sunstrucksynapse-com` Pages project for deployment history, but its automatic production and preview deployments were disabled on 2026-09-04. It is not the production deployment target.

For commit `83159576d506cbc89e1dce2c71fa5c39ff87f11a`, the former GitHub integration reported a successful deployment and advertised these previews:

- `https://406d0077.sunstrucksynapse-com.pages.dev/`
- `https://phase-0-15-typescript-applic.sunstrucksynapse-com.pages.dev/`

On 2026-08-14, HTTP GET requests to `/` on both URLs returned `404` with an empty response body. A green Pages check therefore confirms only that the legacy integration completed its upload/deployment workflow; it is not proof that the React Router application is healthy or being served.

The repository configuration confirms that the application requires React Router server-side rendering through the Worker entry in `workers/app.ts`. Its production build contains separate client assets and a Worker server bundle rather than a standalone static `index.html`. The exact Pages build command, output directory, and deployment logs are not available through the repository or GitHub check metadata; the check links to an authenticated Cloudflare dashboard. The available evidence is therefore consistent with, but does not by itself prove, a legacy static Pages configuration that does not execute the Worker SSR entry.

The Pages URLs must not be treated as working application previews. Production is deployed through the Worker build trigger, which runs `npm run build` and `npx wrangler deploy` from `main`; `npm run dev` and `npm run preview` remain the valid local Cloudflare Workers runtime checks.

## Durable artwork palette deployment

Use the explicit [artwork palette rollout and backfill runbook](artwork-palette-deployment.md) for migration-first private encoder/application deployment, producer activation, dry-run review and bounded write backfill. The opt-in `npm run deploy:palettes` wrapper is separate from `npm run build`; the dashboard trigger must be updated by an operator before it runs on deployment. Existing production artwork write backfills are never part of the automatic wrapper.

## Track sharing previews

A public track can have a short cover-art video for Discord. Run this command
for each published track cleared for an off-site excerpt:

```bash
npm run share-preview:publish -- <release-slug> <track-slug>
```

Use an operator environment with FFmpeg, the target catalogue's `DATABASE_URL`
and `MEDIA_DELIVERY_SIGNING_SECRET`, and the account, bucket and scoped R2
credentials from `.env.example`. The command takes up to the first 30 seconds
of the selected listening source, using its audio stream if the source is a
video. It uploads the clip to the existing private media bucket. Run it again
when the selected audio or cover changes. If static media was replaced at the
same URL, append `--replace` to regenerate its clip. Source files and previews
stay out of Git.

The track page includes the player metadata only when the matching preview
exists. Tracks without a preview retain their cover-art card. To verify a
rollout, paste the canonical track URL into Discord, play the video in the
message, and open the same shared URL to confirm full playback on SunSyn. Use
a fresh query string if Discord still shows an older preview.
