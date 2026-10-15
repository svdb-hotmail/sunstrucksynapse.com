# ADR 0009: prepare streaming audio from the accepted private recording

## Status

Implemented for review; Workers Paid is enabled and the deployed private encoder passed its isolated provider smoke test. Application rollout and maintainer UAT remain separate.

The maintainer's 15 October 2026 direction authorizes SunSyn-controlled encoding, artist-supplied cover and release intent, and a publishing queue after acceptance. This activates the previously deferred processing part of ADR 0004. It retains React Router, Workers, Neon, R2 and Cloudflare Access.

## Decision

The acceptance transaction creates a durable preparation job alongside its draft track. It pins the exact immutable review, selected private audio version, resulting track, artist cover and encoding profile. It does not publish media or catalogue parents.

The existing scheduled Worker claims at most one encoding job at a time. A partial unique database index prevents competing active jobs; a twelve-minute lease and a distinct output key for every attempt fence interrupted work. Missing service configuration leaves tasks queued without consuming attempts. Other failures retry with backoff, up to four attempts; a curator can retry a failed task explicitly and that action is audited.

A private Worker service binding forwards the accepted recording to a Cloudflare Container. The container has ffmpeg and no database, R2 or account credentials. It verifies the complete source checksum, probes the actual audio, and produces `sunsyn-mp3-320k-44100-stereo-v1`: MP3, 320 kbit/s, 44.1 kHz, stereo, source metadata and embedded artwork removed. It does not change mastering or loudness. Encoding and transfer have time and size bounds. The service Worker seals the output to a separate private R2 key with native checksum verification; the app checks the resulting metadata and object head before completing the current lease.

Preparation alone creates no publicly deliverable asset row. The curator can privately audition the derivative with authenticated byte ranges. One explicit Publish command locks and checks the complete release, checks the confirmed ordered track IDs, registers the verified derivatives and artist artwork, publishes eligible parents/tracks, and writes lifecycle audits in one Neon batch transaction. Retrying a successful command does not add publication audit records. Private review recordings and review objects are never public audio assets.

Artists submit one track at a time. Album identity comes from the verified invitation owner plus an explicitly selected album project, with reserved artist/release IDs and individual track numbers. Matching names or album titles is not authorization. The first submitted album cover is reused by later tracks; a shared cover cannot be replaced through the normal upload flow. Publication blocks unfinished submitted album tracks, gaps in order and inconsistent cover content. The curator must explicitly confirm that the album is complete.

## Consequences

- Normal curation ends with **Accept & prepare release**, or **Finish & next** to continue curating. Accepted work remains in Publishing.
- Artist cover permissions are recorded separately. Older accepted tracks may supply a missing cover through their original active invitation; this is audited and does not rewrite accepted declarations. Earlier tracks with missing discovery metadata have a one-time curator form.
- Workers Paid and a deployed private encoder service are prerequisites for activating this configuration. The app's main service binding must not be deployed before the encoder exists.
- One active job limits concurrent cost and matches the single encoder container. The cron admits at most one track per minute; long jobs keep later tracks waiting rather than consuming their retries.
- No loudness normalization, HLS, provider migration, full-album intake or automatic editorial approval is introduced.
- Lease fencing prevents late writes from becoming selected media. A provider that commits after a timed-out request can leave an unreferenced private object; operational prefix/lifecycle cleanup remains necessary. Such objects have no public asset registration.

See [rollout and evidence](../../launch-automatic-publishing.md).
