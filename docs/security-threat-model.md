# Security threat model

## Assets and trust boundaries

- **Public listener boundary:** catalogue pages, signed media reads, and anonymous analytics.
- **Invitation boundary:** opaque submission URLs, form data, declarations, and evidence uploads.
- **Curator boundary:** Cloudflare Access identity, allow-listed curator email, catalogue mutations,
  publication transitions, evidence grants, and analytics summaries.
- **Storage boundary:** Neon PostgreSQL is canonical metadata; private R2 namespaces contain
  masters and evidence; publishable derivatives remain separate.
- **Provider boundary:** Cloudflare terminates requests and supplies Access claims, Workers,
  observability, and R2. Postmark receives only transactional-email data when explicitly configured.

## Threats and controls

| Threat                      | Control                                                                                          | Residual risk                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Curator impersonation       | Access JWT issuer/audience validation plus normalized email allow-list                           | Compromised Access account or provider configuration    |
| Invitation guessing         | High-entropy opaque tokens stored only as hashes; uniform unavailable response                   | A submitter can intentionally share a valid link        |
| Submission abuse            | Honeypot audit metadata, 30 mutations per five-minute token window, strict field validation      | Distributed abuse across valid invitations              |
| Upload abuse                | Declared size/type/checksum limits, one-hour sessions, private namespaces, quarantine state      | No automated malware verdict; manual review is required |
| Private evidence disclosure | Private object keys, short-lived scoped grants, curator authorization, access audit              | Authorized-curator endpoint compromise                  |
| Signed URL replay           | HMAC scope and five-minute expiry; asset scope/status rechecked before R2 read                   | A valid URL can be shared until expiry                  |
| Analytics profiling         | No IP storage, tab-scoped random ID stored only as a hash, 90-day deletion, protected aggregates | Low-volume events remain pseudonymous and sensitive     |
| Analytics flooding          | UUID retry deduplication, 120 events per minute per anonymous session, bot flagging              | Attackers can rotate random session IDs                 |
| Destructive publication     | Lifecycle rules, protected curator route, immutable audit records, archive-first takedown        | Database administrator access remains privileged        |
| Dependency/application flaw | High-severity npm audit and CodeQL run inside the Ready/main quality gate                        | Moderate development-tool advisories remain tracked     |

## Security response

Do not place secrets, signed URLs, private object keys, evidence, or database exports in issues or
logs. Revoke exposed credentials at the provider, rotate `MEDIA_DELIVERY_SIGNING_SECRET`, invalidate
affected Access sessions, archive disputed content, preserve relevant audits, and follow
[the incident runbook](operations-runbook.md). High-severity findings block release.
