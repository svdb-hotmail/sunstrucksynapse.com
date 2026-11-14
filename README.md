# SunSyn Radio

SunSyn Radio is intended to become a human-curated listening destination for intentional AI-assisted music:

> Exceptional music made with AI in the process, selected by humans.

Music quality, deliberate human selection, and clear creative-process context define the product. "AI-assisted" describes a range of creative methods; it is not a genre or a substitute for editorial judgment.

SunSyn Radio is the platform name and its public domain is [sunsyn.art](https://sunsyn.art). **Sunstruck Synapse** remains the artist and catalogue identity represented by existing tracks, artwork, fixtures, and historical records; it is not an alternate platform name.

## Current repository state

This repository contains a React Router 8 framework-mode application written in strict TypeScript and running on the Cloudflare Workers runtime through the Cloudflare Vite plugin. It provides a responsive public listening experience backed by the PostgreSQL catalogue, with a persistent global media player, queue and transport controls, and stable artist, release, and track routes.

The first five rights-cleared listener tracks and their publishable media metadata are seeded through Drizzle. Public repository queries exclude non-published records and private assets. Phase 2 adds the Cloudflare Access-protected curator workspace, catalogue and editorial collection management, audited publication scheduling, managed R2 uploads, and signed derivative delivery. Open submissions, search, analytics, and the remaining platform services are still future work.

## Intended product

SunSyn Radio will be the public listening, editorial, and curation product for carefully selected AI-assisted music. It is for listeners seeking considered work, artists using AI as part of an intentional creative process, and curators assessing musical quality, rights information, and creative-process disclosures.

The MVP is curator-led and invitation-oriented. Publication will require deliberate human editorial selection rather than automated ranking or unrestricted uploading.

See the [product scope, terminology, and non-goals](docs/product-scope.md) for the complete definition.

## MVP boundary

The intended MVP centres on a curated catalogue, real continuous audio playback, queue and playback controls, artist/release/track pages, editorial collections, search and filtering, curator administration, structured submissions, rights and creative-process declarations, basic privacy-conscious analytics, and a responsive, accessible web experience.

Phases 1 and 2 implement the catalogue, playback, queue, public entity pages, curator catalogue management, editorial shelves, and controlled publishing portion of that boundary. The MVP excludes open self-publishing, royalty accounting, advertising, native mobile applications, algorithmic recommendation feeds, social features, automated AI-quality scoring, DRM, and payments.

## Future possibilities

Later phases may evaluate broader creator workflows, richer provenance integrations, additional presentation formats, or capabilities associated with LEMM. These are possibilities rather than commitments. The SunSyn Radio MVP will not depend technically on future LEMM infrastructure, and this repository does not contain LEMM functionality.

## Repository structure overview

This simplified tree is representative, not exhaustive; asset directories contain additional artwork, thumbnails, posters, and placeholder files.

```text
sunstrucksynapse.com/
|-- app/
|   |-- components/
|   |-- config/
|   |-- data/
|   |-- design-system/
|   |-- db/
|   |-- routes/
|   |-- styles/
|   |-- types/
|   |-- root.tsx
|   `-- routes.ts
|-- workers/
|   `-- app.ts
|-- drizzle/
|-- scripts/
|   `-- seed.ts
|-- public/
|   `-- assets/
|-- package.json
|-- package-lock.json
|-- react-router.config.ts
|-- vite.config.ts
|-- wrangler.jsonc
|-- README.md
|-- LICENSE
|-- .gitignore
`-- docs/
    |-- architecture/
    |   |-- README.md
    |   `-- decisions/
    |-- design-system.md
    |-- product-scope.md
    |-- deployment.md
    |-- media-protection.md
    |-- content-guide.md
    `-- cloudflare-setup.md
```

## Local development

Node.js 22.22 or later and npm are required. Install the lockfile-controlled dependency graph:

```bash
npm ci
```

Start the Cloudflare-aware development server:

```bash
npm run dev
```

The Cloudflare Vite plugin runs server code inside the Workers runtime during development.

## Type checking and builds

Generate Worker and React Router types, then run strict TypeScript checking:

```bash
npm run typecheck
```

Create the production Worker and client bundles:

```bash
npm run build
```

Preview that production build locally in the Workers runtime:

```bash
npm run preview
```

No deployment script or Cloudflare account configuration is included in this phase.

## Quality gates

Run the pre-MVP quality gate after installing dependencies and FFmpeg:

```bash
npm run ci
```

The aggregate runs formatting, lint, strict TypeScript, unit/contract tests,
audio encoder tests, local PGlite database validation, and the production build.
Database validation uses local fixtures and does not contact an external database.

GitHub Actions exposes these checks as separate steps under the stable required
check `CI / quality-gate`, with a ten-minute limit. It validates non-draft PRs,
including stacked PRs, and pushes to `main`. Dependency auditing and CodeQL run
in a separate parallel security job.

User journeys, browser compatibility, Storybook, and exact preview design
baselines are outside automatic CI while the pre-MVP design is evolving. Run
these checks manually when reviewing the relevant experience:

```bash
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm run build-storybook
npm run test:site-preview
```

The E2E command builds its own test-mode application before starting the preview
server. The site-preview tests require the Storybook/site-preview build above.

## Documentation

- [Security policy](SECURITY.md) and [contribution guide](CONTRIBUTING.md)
- [GitHub settings and outstanding administrator steps](docs/github-repository-settings.md)
- [Kobold Technologies owner-migration preparation](docs/kobold-technologies-owner-migration.md)

- [Product scope, terminology, and non-goals](docs/product-scope.md)
- [Design system, tokens, theming, and Storybook](docs/design-system.md)
- [MVP architecture and accepted decisions](docs/architecture/README.md)
- [Deployment guidance](docs/deployment.md)
- [Content integration guide](docs/content-guide.md)
- [Media protection notes](docs/media-protection.md)
- [Cloudflare configuration guide](docs/cloudflare-setup.md)
- [Database setup, migrations, seeding, and recovery](docs/database.md)

## Media warning

Do not commit large original or master media files unless intentional. Keep source exports in local or offline storage or dedicated private storage, and commit only optimized public web assets.
