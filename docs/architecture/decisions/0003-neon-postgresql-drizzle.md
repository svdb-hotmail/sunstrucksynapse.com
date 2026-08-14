# ADR 0003: Neon PostgreSQL and Drizzle

## Status

Accepted

## Context

The catalogue includes related artists, releases, tracks, editorial collections, submissions, lifecycle states, rights declarations, provenance records, and media references. These records need relational constraints, deliberate migrations, and auditable state transitions. The final schema is not yet designed.

## Decision

Use Neon PostgreSQL as the managed production relational database and Drizzle as the TypeScript query and migration layer. Keep schema changes in reviewed migrations and use database constraints for invariants that must hold independently of application code.

Use isolated Neon development branches or equivalent databases for non-production work. An optional local Docker PostgreSQL instance may support offline development, but it must run the same migrations.

## Consequences

### Positive consequences

- PostgreSQL supports relationships and constraints across catalogue, lifecycle, rights, and provenance data.
- Reviewed migrations create an explicit history of schema evolution.
- Drizzle provides typed TypeScript access while retaining visible SQL concepts.
- Neon reduces database server operations and supports isolated development databases.

### Costs and limitations

- Connection management must respect Worker runtime characteristics.
- Database and migration compatibility must be tested across local PostgreSQL and Neon.
- Typed queries do not replace authorization, runtime input validation, or database constraints.
- This decision does not settle table design, retention, indexing, or every lifecycle rule.

## Rejected alternatives

### Cloudflare D1

This was considered because it integrates closely with Workers and offers a low-operations SQLite model. It is not selected now because the domain is relationship-heavy and PostgreSQL offers a stronger constraint, migration, and query model for expected catalogue and provenance workflows. It should be reconsidered if the data model proves simpler, D1's capabilities mature to meet all identified constraints, and operational locality outweighs PostgreSQL features.

### Document database

This was considered because flexible documents can accelerate early schema iteration and map naturally to some catalogue views. It is not selected now because cross-record integrity, rights and provenance relations, and lifecycle transitions benefit from explicit relational constraints. It should be reconsidered for a separately bounded workload whose access patterns are document-oriented and do not require relational integrity.

### Self-hosted PostgreSQL

This was considered because it maximizes infrastructure control and portability. It is not selected now because backups, patching, failover, monitoring, and capacity management would add operations without providing an MVP advantage. It should be reconsidered if scale, compliance, cost, or required database extensions make managed Neon unsuitable and the team can own production database operations.

## Follow-up implications

- Design the initial schema and lifecycle invariants separately; this ADR does not finalize them.
- Establish migration review, rollback, backup, and recovery practices before production data exists.
- Separate database credentials by environment and prevent browser access to all database connections.

## Related tickets and ADRs

- [Architecture issue #11](https://github.com/svdb-hotmail/sunstrucksynapse.com/issues/11)
- [ADR 0001: React Router 7 and TypeScript](0001-react-router-typescript.md)
- [ADR 0002: Cloudflare Workers runtime and deployment](0002-cloudflare-workers-runtime.md)
- [ADR 0004: Cloudflare R2 media storage and controlled delivery](0004-r2-media-storage-delivery.md)
