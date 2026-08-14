# ADR 0004: Cloudflare R2 media storage and controlled delivery

## Status

Accepted

## Context

The product needs artwork, playable audio derivatives, original masters, and submission evidence. These assets have different publication and confidentiality requirements. Large binaries do not belong in Git or PostgreSQL, and audio playback requires caching and byte-range support.

## Decision

Store artwork and audio assets in Cloudflare R2. Keep original masters, publishable derivatives, artwork, and submission evidence as distinct asset classes with separate scopes or buckets and credentials where practical.

Masters and evidence remain private and are never served through a public route. The application authorizes access to published derivatives and returns short-lived signed access. Delivery must define expiry, cache policy, content type, and byte-range behavior. Evidence receives stricter private handling than publishable media.

Signed access is an authorization and hotlink-mitigation control, not DRM. It cannot prevent a determined user from capturing media that their device can play. Transcoding and derivative-generation infrastructure are deferred.

## Consequences

### Positive consequences

- Object storage keeps large files outside source control and the relational database.
- Separate asset scopes reduce the chance that masters or evidence inherit public derivative policy.
- Controlled derivative delivery supports authorization, expiry, caching, and playback ranges.
- R2 integrates with the selected Worker request boundary and Cloudflare delivery network.

### Costs and limitations

- Upload, promotion, deletion, cache, and lifecycle workflows must preserve asset-class boundaries.
- Signed URLs can be shared until expiry and do not prevent recording or determined capture.
- Byte-range requests and cache keys require deliberate implementation and testing.
- A later processing system is still needed to validate, transcode, and generate derivatives.

## Rejected alternatives

### Make every R2 object publicly addressable

This was considered because direct public URLs are simple and cache efficiently. It is not selected now because one policy cannot safely cover derivatives, masters, and submission evidence, and permanent URLs provide little control over hotlinking or withdrawn content. It should be reconsidered only for intentionally public, immutable derivatives where revocation and access policy are unnecessary.

### Store media in Git or PostgreSQL

This was considered because it would reduce the number of services and keep references close to application data. It is not selected now because large binaries would inflate repository or database operations, backups, and delivery cost while providing poor streaming semantics. It should be reconsidered only for very small metadata-adjacent fixtures, never for production masters or listening media.

### Use a separate object-storage provider

This was considered because S3-compatible providers offer mature storage and media ecosystems. It is not selected now because R2 reduces integration boundaries with Workers and avoids an additional production provider for the MVP. It should be reconsidered if R2 lacks required durability, lifecycle, compliance, processing, or delivery capabilities.

## Follow-up implications

- Define asset identifiers, states, retention, deletion, and promotion from private source to public derivative.
- Implement range-aware delivery and test seeking, caching, expiry, withdrawal, and authorization.
- Select a transcoding workflow later without granting processors broader master or evidence access than required.
- Ensure database records contain asset references and metadata, not large file contents.

## Related tickets and ADRs

- [Architecture issue #11](https://github.com/svdb-hotmail/sunstrucksynapse.com/issues/11)
- [ADR 0002: Cloudflare Workers runtime and deployment](0002-cloudflare-workers-runtime.md)
- [ADR 0003: Neon PostgreSQL and Drizzle](0003-neon-postgresql-drizzle.md)
