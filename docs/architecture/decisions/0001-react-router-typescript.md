# ADR 0001: React Router 8 and TypeScript

## Status

Accepted

## Context

The MVP needs a public listening experience, editorial and catalogue routes, and a curator workspace. Continuous audio should survive navigation, so playback state belongs in a persistent application shell rather than being recreated on every page. Browser and server code will also share contracts for catalogue records, playback events, submissions, and API errors.

The current repository is a static prototype and does not yet impose a framework or build system. It has no legacy React Router application or dependency compatibility constraint that would justify starting a new implementation on the previous major version.

## Decision

Build the MVP web application with the stable React Router 8 major line and TypeScript. Do not pin this architecture decision to an exact patch release; implementation must use lockfile-controlled dependency resolution.

Use Node.js 22.22 or later, React and React DOM 19.2.7 or later, Vite 7 or later, the Cloudflare Vite plugin, and an ESM-compatible project configuration. Use the current Cloudflare full-stack Worker scaffold as the implementation baseline. React Router 8 is the current stable major; middleware and Vite Environment API behavior are defaults, and version 8 is supported by Cloudflare's current React Router scaffold. Starting this greenfield application on version 7 would create an immediate migration without preserving any legacy compatibility.

Use a persistent root application shell for the player and queue so route transitions do not interrupt playback. Use TypeScript contracts at application boundaries and share types or schemas between browser and Worker code where doing so preserves one authoritative contract.

This decision does not require an immediate rewrite of the static prototype; implementation will occur in a later phase.

## Consequences

### Positive consequences

- Nested routing and data APIs support public, editorial, and curator surfaces in one application model.
- A persistent React shell provides an explicit home for uninterrupted playback and queue state.
- TypeScript makes client/server contracts and lifecycle states reviewable before runtime.
- React Router can run with the selected Cloudflare Worker architecture without requiring a separate permanent application server.
- Starting on the current stable major avoids scheduling an immediate version 7-to-8 migration.
- The Cloudflare Vite plugin runs local application code in the Worker runtime and aligns development with the selected deployment target.

### Costs and limitations

- The project will need a build pipeline, dependency maintenance, and framework-specific testing.
- The implementation baseline requires Node.js 22.22 or later, React and React DOM 19.2.7 or later, Vite 7 or later, and ESM-compatible project configuration.
- Dependencies and custom Vite configuration must be checked for React 19, ESM, Vite 7, and Cloudflare Worker compatibility.
- Local development and tests must exercise Worker behavior through the Cloudflare Vite plugin rather than assuming a general-purpose Node.js server.
- Shared types do not validate untrusted runtime input; boundary schemas and validation remain necessary.
- Care is required to prevent route loaders, hydration, or error boundaries from resetting playback.
- Framework upgrades may require coordinated route and deployment changes.
- Unstable React Router APIs remain out of scope unless a separate ADR accepts their risk and migration cost.

## Rejected alternatives

### Continue with static HTML and JavaScript

This was considered because it keeps the prototype simple and has almost no tooling overhead. It is not selected now because persistent playback, typed API contracts, and several stateful application surfaces would require a growing bespoke architecture. It should be reconsidered if the product is reduced to a small, read-only site without continuous playback or authenticated workflows.

### React Router 7

This was considered because it has a documented, incremental upgrade path to version 8 and remains relevant for existing applications that need time to adopt new runtime, React, Vite, middleware, or Environment API requirements. It is not selected now because this is a greenfield implementation, version 8 is the current stable major and Cloudflare scaffold baseline, and no legacy compatibility constraint offsets the cost of an immediate migration. It should be reconsidered only if a verified required dependency is incompatible with version 8 and no reasonable version 8-compatible alternative exists.

### Next.js

This was considered because it has a mature React ecosystem, routing, server rendering, and broad hosting support. It is not selected now because its preferred deployment and server abstractions add complexity beyond the Worker-centred architecture and may couple the application more strongly to a hosting model. It should be reconsidered if the product needs Next.js-specific rendering, caching, or ecosystem capabilities that clearly outweigh that coupling.

### Astro

This was considered because it is strong for content-heavy sites and can minimize shipped JavaScript. It is not selected now because the core listening experience and curator workspace are long-lived interactive applications, reducing the benefit of an islands-first model. It should be reconsidered if editorial publishing becomes the dominant workload and interactive features can be isolated into a few bounded islands.

## Follow-up implications

- Define route boundaries, loader/action contracts, runtime validation, and player-state ownership before implementation.
- Test navigation, errors, and session changes without interrupting active playback.
- Establish the supported Node.js version and lockfile in the implementation change, and verify the selected dependency graph against React 19, ESM, Vite 7, and the Worker runtime.
- Exercise local development, server rendering, bindings, and deployment builds with the Cloudflare Vite plugin.
- Decide how generated database types and API schemas are exposed without coupling browser code to persistence internals.

## Related tickets and ADRs

- [Architecture issue #11](https://github.com/svdb-hotmail/sunstrucksynapse.com/issues/11)
- [ADR 0002: Cloudflare Workers runtime and deployment](0002-cloudflare-workers-runtime.md)
- [ADR 0007: First-party, privacy-conscious analytics](0007-first-party-analytics.md)

## References

- [React Router changelog](https://reactrouter.com/home/changelog)
- [React Router: Updating from v7](https://reactrouter.com/upgrading/v7)
- [Cloudflare Workers: React Router framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- [Cloudflare Workers: Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
