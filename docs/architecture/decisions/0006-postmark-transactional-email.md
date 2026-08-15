# ADR 0006: Postmark for transactional email

## Status

Accepted

## Context

Submission workflows need reliable, auditable messages for confirmation, clarification requests, acceptance, and rejection. The MVP does not include marketing automation or newsletters.

## Decision

Use Postmark for transactional application email. Limit the initial integration to submission confirmation, clarification, acceptance, rejection, and similarly necessary service messages. Keep application lifecycle state in PostgreSQL; delivery-provider status is not the product source of truth.

Use Postmark test mode or an explicit non-delivering adapter outside production. Do not use this integration for marketing, newsletters, cross-site tracking, or unrelated audience management.

## Consequences

### Positive consequences

- A focused transactional provider supplies delivery infrastructure and operational visibility.
- Product messages can use reviewed templates and explicit lifecycle triggers.
- Non-delivering local behavior avoids accidental messages during development.
- Keeping workflow state in the application avoids coupling decisions to an email provider.

### Costs and limitations

- Recipient data and message content cross a third-party boundary.
- Templates, sender verification, suppression handling, and delivery failures need operational ownership.
- Email delivery is asynchronous and cannot be treated as proof that a recipient read a decision.
- A separate solution would be needed if marketing communication enters scope.

## Rejected alternatives

### Amazon SES

This was considered because it is capable, cost-effective at scale, and widely supported. It is not selected now because it requires more deliverability and operational assembly than a focused transactional service for the expected MVP volume. It should be reconsidered if sending volume, cost, or existing AWS operations justify that additional ownership.

### Resend

This was considered because it offers a modern developer experience and straightforward transactional APIs. It is not selected now because Postmark's established transactional focus and delivery tooling are preferred for the initial workflow. It should be reconsidered if Resend provides materially better regional, template, support, or integration fit.

### Self-hosted SMTP

This was considered because it avoids an application-level email vendor and offers infrastructure control. It is not selected now because reputation, deliverability, abuse prevention, retries, and monitoring would create disproportionate operational risk. It should be reconsidered only if regulatory or organizational requirements demand direct operation and the team can own deliverability.

## Follow-up implications

- Define templates, sender identities, reply handling, data minimization, and retention.
- Make email triggers idempotent and record delivery attempts without replacing submission state.
- Ensure local and test environments cannot address real recipients through production credentials.

## Related tickets and ADRs

- [Architecture issue #11](https://github.com/svdb-hotmail/sunstrucksynapse.com/issues/11)
- [ADR 0003: Neon PostgreSQL and Drizzle](0003-neon-postgresql-drizzle.md)
