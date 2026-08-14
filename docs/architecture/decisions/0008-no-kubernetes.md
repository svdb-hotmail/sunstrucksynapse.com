# ADR 0008: No Kubernetes dependency

## Status

Accepted

## Context

The MVP uses managed edge compute, database, object storage, access, and email services. The expected scale and current operational capacity do not require a general-purpose container orchestration control plane.

## Decision

Do not introduce Kubernetes as a development, deployment, or production dependency for the MVP. Deploy the web application and API to Cloudflare Workers and use the selected managed services directly.

Containerized local dependencies remain acceptable. Future isolated media-processing or batch jobs may also use containers on an appropriate managed execution service without making Kubernetes a prerequisite for the web application or ordinary development.

## Consequences

### Positive consequences

- The team avoids cluster provisioning, upgrades, networking, policy, observability, and on-call burden.
- Local setup and production deployment have fewer infrastructure layers.
- Operational effort remains focused on product boundaries and managed-service configuration.
- Future auxiliary containers are not prohibited when a concrete workload justifies them.

### Costs and limitations

- The architecture does not provide a common orchestration layer across every workload.
- Provider-specific deployment and bindings may reduce infrastructure portability.
- A future compute-heavy pipeline may need a new execution decision.
- Avoiding Kubernetes does not remove the need for monitoring, incident response, or infrastructure discipline.

## Rejected alternatives

### Kubernetes for the MVP

This was considered because it standardizes container scheduling, service discovery, policy, and scaling. It is not selected now because there are no persistent services or organizational scale that justify the control-plane and operational cost. It should be reconsidered if multiple long-running services, tenancy, portability, policy, or scaling requirements demonstrably exceed the managed platform.

### A permanent container platform without Kubernetes

This was considered because it would preserve container portability with less cluster management. It is not selected now because a permanent web server still adds lifecycle and scaling work compared with the selected Worker runtime. It should be reconsidered if the application requires runtime capabilities or sustained workloads that Workers cannot support.

### Require containers for all local development

This was considered because it can standardize tool and service versions. It is not selected now because Wrangler and managed non-production services should support a lighter default, while Docker PostgreSQL remains optional for offline work. It should be reconsidered if environment drift becomes a recurring problem that a maintained container setup can solve without hiding production differences.

## Follow-up implications

- Keep deployment documentation free of implicit cluster requirements.
- Evaluate future media jobs by workload, security boundary, and operational ownership before selecting an execution platform.
- Record a new ADR if scale or service topology creates a concrete orchestration need.

## Related tickets and ADRs

- [Architecture issue #11](https://github.com/svdb-hotmail/sunstrucksynapse.com/issues/11)
- [ADR 0002: Cloudflare Workers runtime and deployment](0002-cloudflare-workers-runtime.md)
- [ADR 0004: Cloudflare R2 media storage and controlled delivery](0004-r2-media-storage-delivery.md)
