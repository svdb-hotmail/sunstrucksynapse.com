# ADR 0002: Cloudflare Workers runtime and deployment

## Status

Accepted

## Context

The MVP needs a public web application and API boundary close to Cloudflare-managed media delivery and curator access. Expected initial traffic and operational capacity do not justify maintaining permanent web servers or a container orchestration platform.

## Decision

Use Cloudflare Workers as the production request runtime and deployment target for the web application and API. Use Worker bindings and Cloudflare integrations for environment configuration, R2 access, and the curator boundary. Develop and test Worker behavior locally with Wrangler.

Docker remains acceptable for local dependencies and future auxiliary or batch workloads, but a permanently running container is not the production web runtime.

## Consequences

### Positive consequences

- Request handling deploys globally without managing web servers.
- Workers integrate directly with R2 and the wider Cloudflare edge.
- The operational model fits an early product with a small team and variable traffic.
- Local Wrangler execution can exercise the production runtime model.

### Costs and limitations

- Worker runtime APIs, limits, and deployment configuration differ from a general-purpose Node.js server.
- Long-running or compute-heavy media processing will require a separate execution model.
- Cloudflare service integration increases provider concentration.
- Local emulation cannot perfectly reproduce every production edge behavior.

## Rejected alternatives

### Vercel

This was considered because it offers polished web-framework deployment, previews, and managed functions. It is not selected now because the architecture already relies on Cloudflare R2 and Access, and keeping the request boundary on Cloudflare reduces cross-provider integration. It should be reconsidered if framework-specific Vercel capabilities become essential or Cloudflare runtime constraints impede the product.

### Netlify

This was considered because it provides simple web deployment, previews, and managed functions. It is not selected now because it does not offer a stronger fit than Workers for the selected Cloudflare storage and access boundaries. It should be reconsidered if Netlify's workflow, platform features, or organizational support materially improves delivery.

### Permanently running containers

This was considered because containers provide a familiar, portable, general-purpose runtime. It is not selected now because server lifecycle, patching, scaling, and availability would add operational work without an identified MVP need. It should be reconsidered if the request path requires unsupported runtimes, persistent connections, or workloads that are demonstrably unsuitable for Workers.

## Follow-up implications

- Define Worker bindings and validate required environment variables at startup or request entry.
- Keep application code within Worker-compatible APIs and test relevant runtime limits.
- Select a separate, bounded execution service if later transcoding or media jobs exceed Worker capabilities.

## Related tickets and ADRs

- [Architecture issue #11](https://github.com/svdb-hotmail/sunstrucksynapse.com/issues/11)
- [ADR 0001: React Router 8 and TypeScript](0001-react-router-typescript.md)
- [ADR 0004: Cloudflare R2 media storage and controlled delivery](0004-r2-media-storage-delivery.md)
- [ADR 0008: No Kubernetes dependency](0008-no-kubernetes.md)
