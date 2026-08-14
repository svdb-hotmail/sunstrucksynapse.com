# Deployment

The application targets Cloudflare Workers through React Router framework mode and the Cloudflare Vite plugin, as recorded in [ADR 0002](architecture/decisions/0002-cloudflare-workers-runtime.md).

Production deployment, account setup, custom-domain changes, and secrets are intentionally outside the current application migration. The repository contains no Cloudflare account or resource identifiers.

## Build boundary

Use Node.js 22.22 or later:

```bash
npm ci
npm run typecheck
npm run build
npm run preview
```

`wrangler.jsonc` declares the source Worker entry without account-specific values. The Cloudflare Vite plugin produces the deployable client and Worker output under `build/`, including the generated Worker build configuration. A later deployment change must define the production workflow and verify the final domain separately.
