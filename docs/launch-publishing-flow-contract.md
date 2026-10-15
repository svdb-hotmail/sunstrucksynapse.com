# Submission to publication: maintainer direction

15 October 2026, Europe/Brussels. This records the maintainer's latest product decisions. It supersedes the manual public-listening reupload, curator-supplied cover and curator-decided single/album assumptions in the earlier launch implementation. The maintainer subsequently said “go”, authorizing implementation of these requirements. Code and focused evidence are in [the implementation and rollout record](launch-automatic-publishing.md); production activation remains blocked.

## Human journey

- An invited artist submits one track at a time, with private review audio, cover artwork, the track details and the existing rights/process/provenance declarations.
- The artist chooses whether that track is a single or belongs to an album. Album association is supplied during the individual track submission. The artist cannot yet upload or submit a complete album in one operation.
- Existing submission data carries into review and publishing. Covers and release choices should not be requested again from the curator. Tracks intended for the same album must retain that intention and order without grouping unrelated artists by display name.
- Curation remains a human decision with the existing four assessments, explicit grade and rationale. Acceptance does not itself publish anything.
- Acceptance automatically creates or updates a persistent publishing task and starts SunSyn-controlled encoding from the exact accepted private review recording. The curator can open that task immediately or continue reviewing other tracks and resume from Publishing later.
- SunSyn produces a separate, verified streaming derivative using one versioned encoding profile. The source recording stays private and unchanged. The curator does not export, convert or reupload a listening file.
- The artist's submitted cover is carried forward to the intended single or album. Reuse within an album should not require the curator to upload or apply it to every track.
- Publishing shows Preparing, Ready, or Needs attention. The normal curator task is checking the presentation and album order/completeness, then explicitly publishing the single or album. Preparation can wait in the queue while curation continues.

## Required integrity and operational behavior

- Pin the derivative job to the exact accepted review, source audio version/checksum, resulting track and encoding-profile version. Preserve track IDs and accepted declaration links.
- Encoding is a background job with bounded attempts, exclusive ownership, retry-safe completion and visible failures. Do not encode large recordings inside the interactive request that records a curation decision.
- Encoding completion alone must not expose the private source or unpublished derivative. Explicit publication remains the public-visibility boundary.
- Validate actual output format, duration, size and checksum before marking preparation ready. A failed or incomplete encoding blocks publication; there is no bypass.
- Submitter cover uploads need invitation-bound authorization, type/size validation and immutable stored metadata. Cover permissions must be supplied by the artist; do not fabricate declarations.
- Album grouping needs an authorized artist/album identity; matching a title, filename or artist display name is insufficient authority. Keep one-track intake and make album completeness visible before the atomic publication action.
- Existing production submissions, reviews and media remain intact. Missing artwork or album intent must not be invented or silently backfilled.
- Reuse the existing Storybook/design system, React Router, Worker, Neon and R2 boundaries. Test any necessary forward migration in an identified isolated environment first. No production reset or seed.

## Submission guidance and discovery selections

The maintainer additionally requires visible upload-format guidance and cover dimensions on the artist submission page. Genres, moods and creative process tags must use dropdowns with predefined options and allow multiple selections in every category. This replaces the free-text fields in the first schematic, including the single-value genre assumption. Preserve every selected genre as a separate value; do not silently keep only the first genre or join them into one genre string.

The revised schematic carries the current private-audio allowlist and size ceiling: WAV, FLAC, MP3, M4A, OGG or WebM; maximum 500 MiB. It distinguishes a preferred lossless source (WAV/FLAC) from formats the app accepts. The planned intake should validate actual format/metadata, give an actionable error, and describe the automatic streaming derivative without requiring the artist to create one.

Approved for implementation after the schematic and subsequent “go”: square 1:1, minimum 1400 × 1400 px, recommended 3000 × 3000 px, JPEG/PNG/WebP/AVIF, maximum 20 MiB. The formats and size match the existing media service; the square/minimum-dimension requirement is implemented in this increment and is not yet deployed. Show the requirements before selection and check the actual image dimensions before upload. Do not invent dimensions, upscale, or crop artist artwork silently.

The genre, mood and process-tag lists shown in the schematic are the starting vocabularies authorized for this increment. Each dropdown supports checkbox selection, option search and removable selection chips without requiring keyboard modifiers. Implementation needs one canonical allowlist shared by artist input, validation, curator presentation and discovery filtering. Public process tags remain explicit artist choices and must not replace or fabricate the reviewed process disclosure.

## Current implementation boundary

The source now implements artist intake, preparation jobs, the private encoder, the publishing queue and atomic registration/publication. [Implementation evidence and deployment sequence](launch-automatic-publishing.md) distinguish passed focused checks from outstanding provider and production checks. Main at `ba39f9805bc0d553571f26ac7d3476da64889f22` still has the older separate public-listening upload flow. No production deployment is claimed for this increment.

The maintainer-authorized SOLO exception remains active; no other agents or independent approval are claimed.
