# Media Protection Notes

## Important limitation

Browser-level controls can hide download buttons, disable right-click menus, or obscure direct URLs, but they **cannot** make publicly delivered media impossible to extract. If media can be played in a public browser session, a determined user can still capture it.

## Managed R2 delivery

Managed artwork and prepared audio use the private `MEDIA_BUCKET` binding. Curators declare MIME type, byte size, lowercase SHA-256, scope, and:

- artwork dimensions; maximum 20 MiB; JPEG, PNG, WebP, or AVIF;
- audio track, duration, and codec; maximum 500 MiB; MPEG, MP4, Ogg, WebM, FLAC, or WAV.

Sessions expire after one hour. Upload verifies type, size, and checksum. Completion creates the asset metadata. Cleanup deletes expired pending objects and marks sessions `abandoned`; failed checks retain `failed` metadata. Configure an operational cleanup trigger separately.

`private_master` objects are never public. Only `publishable_derivative` R2 assets in `ready` state are served through five-minute HMAC-signed `/media/...` URLs. Scope and status are rechecked before R2 reads. Phase 1 `static` rows retain their paths.

**Never commit masters, derivatives, evidence, or other large media to Git.** Existing small Phase 1 fixtures are the only exception; new media belongs in R2.

## Submission evidence

Submission evidence uses the private `private/evidence/` namespace inside R2. The application stores metadata, checksum, upload status, malware-review status, and audit records in PostgreSQL, but public catalogue payloads and disclosure pages never serialize evidence object keys or URLs.

Private evidence policy:

- Maximum upload size: 20 MiB per file.
- Allowed MIME types: `text/plain`, `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `audio/mpeg`, `audio/wav`, `audio/ogg`.
- SVG, archive formats, and any MIME type outside the allowlist are rejected.
- The submission route validates file type and size before hashing.
- The declared upload session enforces the same MIME and size constraints before accepting bytes.

Curators may mint short-lived access links for specific evidence files. Each grant and each successful read is audited. Evidence defaults to `pending_review`; manual review may mark it `cleared`, `quarantined`, or `rejected`. Quarantined or rejected files are excluded from the short-lived access flow.

Retention remains conservative and explicit: evidence is retained privately for review and audit purposes until a curator schedules deletion. Suspicious files require manual quarantine handling rather than any automated "clean" claim.

## Stronger protection options

For stronger protection than basic front-end controls, consider:

- Private media hosting (authenticated access)
- Signed URLs with expiry and scope restrictions
- Adaptive streaming (HLS/DASH)
- DRM-based playback controls

## Google Cloud options to evaluate

Possible stronger options include:

- **Google Cloud Storage** for controlled/private object storage
- **Google Transcoder API** to prepare streaming renditions
- **Media CDN signed URLs** for time-limited, controlled distribution
- **Widevine DRM** for stronger content protection workflows

These options improve control but also increase complexity and cost. Choose based on your threat model and business needs.
