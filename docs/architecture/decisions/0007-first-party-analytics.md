# ADR 0007: First-party, privacy-conscious analytics

## Status

Accepted

## Context

Curators need enough evidence to understand whether catalogue and playback experiences work, but the product does not need advertising profiles, cross-site identity, or opaque recommendation systems. Playback must remain reliable even when measurement fails.

## Decision

Collect only first-party, privacy-conscious semantic events needed to operate and improve the product. Examples include playback start, meaningful progress, completion, skip, playback error, search, and editorial-link interaction. Define event meaning, data minimization, retention, and access before collection.

Send events through the application boundary without cross-site advertising identifiers. Analytics delivery is best-effort: collection, storage, or processing failures must never interrupt playback. Do not use analytics as a black-box recommendation feed or automated editorial authority.

Local development uses no-op collection or structured local logging rather than production destinations.

## Consequences

### Positive consequences

- Semantic events answer explicit product and reliability questions.
- First-party collection limits unnecessary data sharing and tracking scope.
- Playback remains independent from analytics availability.
- Human editorial control is not displaced by opaque behavioral ranking.

### Costs and limitations

- Event definitions, quality checks, retention, and access controls require ongoing governance.
- First-party infrastructure provides fewer turnkey dashboards than broad analytics suites.
- Data minimization may limit retrospective questions that were not designed into events.
- Even pseudonymous playback data can be sensitive and needs careful aggregation and retention.

## Rejected alternatives

### Advertising-oriented web analytics

This was considered because it provides mature acquisition reporting and familiar dashboards. It is not selected now because cross-site advertising identifiers and audience profiling conflict with the MVP's privacy and non-advertising boundaries. It should be reconsidered only if the business model changes, explicit consent and governance are designed, and less invasive measurement cannot meet a justified need.

### General third-party product analytics SDK

This was considered because it could accelerate funnels, dashboards, and event exploration. It is not selected now because broad browser SDK collection and external user profiles can exceed the small set of operational questions the MVP needs. It should be reconsidered if a provider can meet strict first-party, minimization, retention, regional, and failure-isolation requirements better than the in-house path.

### Collect no analytics

This was considered because it provides the smallest privacy and implementation footprint. It is not selected now because playback failures, catalogue use, and editorial outcomes need some aggregate evidence for responsible operation. It should be reconsidered for features where no defined operational or product question justifies collection.

## Follow-up implications

- Produce a versioned event catalogue with purpose, fields, retention, and aggregation rules.
- Keep analytics writes off the playback-critical path and test failure isolation.
- Define deletion, access, bot filtering, and low-volume privacy practices before production collection.

## Related tickets and ADRs

- [Architecture issue #11](https://github.com/svdb-hotmail/sunstrucksynapse.com/issues/11)
- [ADR 0001: React Router 7 and TypeScript](0001-react-router-typescript.md)
- [ADR 0002: Cloudflare Workers runtime and deployment](0002-cloudflare-workers-runtime.md)
