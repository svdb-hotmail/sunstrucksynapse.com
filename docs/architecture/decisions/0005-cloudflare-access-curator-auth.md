# ADR 0005: Cloudflare Access for initial curator authentication

## Status

Accepted

## Context

The curator workspace is initially a small, staff-only operational surface. It needs an identity boundary before application authorization is implemented, while public listener and future artist identities have different product requirements that are not yet designed.

## Decision

Protect the initial curator workspace with Cloudflare Access. The application must verify the identity context supplied through Access and still apply curator authorization to sensitive operations.

This decision applies only to the initial curator workspace. Cloudflare Access is not the final authentication design for listeners, artists, public submissions, or broader creator accounts. Local development may explicitly simulate a curator identity, but that bypass must be impossible to enable in production.

## Consequences

### Positive consequences

- The initial private workspace gains managed identity controls without first building account recovery and credential storage.
- Access integrates with the selected Cloudflare request boundary.
- Curator exposure can remain narrow while product-facing identity requirements are discovered.
- Production curator access can be managed independently from application data.

### Costs and limitations

- The application depends on correct proxy placement and verification of Access identity claims.
- Access policy and application authorization are separate controls and must not be confused.
- Local identity simulation differs from production and needs explicit tests.
- A separate identity architecture will be required if listener or artist accounts enter scope.

## Rejected alternatives

### Build application-managed authentication now

This was considered because it could eventually support curators, artists, and listeners through one account system. It is not selected now because password, recovery, verification, session, abuse, and support concerns exceed the needs of the small initial curator group. It should be reconsidered when product-facing accounts have defined roles, journeys, security requirements, and ownership.

### Shared curator password

This was considered because it is quick to implement and easy to understand. It is not selected now because it lacks individual accountability, safe revocation, and strong identity policy. It should be reconsidered only as a short-lived emergency recovery mechanism with explicit controls, not as normal authentication.

### Publicly reachable workspace with application checks alone

This was considered because application authorization is required in any case. It is not selected now because an additional managed edge identity boundary reduces exposure of an early operational surface. It should be reconsidered if the workspace becomes a public product surface with a purpose-built authentication system and equivalent controls.

## Follow-up implications

- Specify accepted Access issuers, audiences, identity fields, roles, and failure behavior.
- Add application-level authorization and audit-sensitive curator actions.
- Ensure production startup rejects any local identity-simulation setting.
- Design listener and artist authentication separately if those accounts become MVP requirements.

## Related tickets and ADRs

- [Architecture issue #11](https://github.com/svdb-hotmail/sunstrucksynapse.com/issues/11)
- [ADR 0002: Cloudflare Workers runtime and deployment](0002-cloudflare-workers-runtime.md)
- [ADR 0003: Neon PostgreSQL and Drizzle](0003-neon-postgresql-drizzle.md)
