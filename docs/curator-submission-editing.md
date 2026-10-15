# Curator artwork and metadata corrections

Curators can open **Edit details** from a submission row, **Edit artwork and details** from a review, or the same link beside an accepted track in Publishing. The editor supports track title, release title and description, genres, moods, process tags and replacement artwork. A reason is required; artwork also requires the curator's explicit permission acknowledgement. Saving does not accept a review or publish a release.

The editor works before acceptance and on accepted, unpublished tracks, including submissions from before artwork intake existed. It preserves the artist's original submission, rights declaration, disclosure, provenance, private audio, final grade and review links. Corrections are separate append-only curator activity records. Accepted catalogue metadata changes in the same transaction as its audit note. Published, withdrawn and rejected submissions are read-only here. Artist identity, album membership, source audio and declarations remain outside this editor; Publishing retains its audited track-order tools.

The existing light/dark curator design system is reused. Storybook includes missing artwork, replacement, saving, stale conflict, light theme and mobile stories. Inputs remain on validation failures. A stale revision is rejected instead of overwriting another curator's changes. Publication confirmation carries a release revision, checked again inside the atomic publisher.

## Artwork and preparation

Covers are square JPG, PNG, WebP or AVIF, up to 20 MiB and 10000 pixels. Smaller square images resize in the browser to the existing 1400-pixel minimum without cropping. The server validates actual dimensions/type, computes SHA-256 and asks R2 to verify the native checksum. New curator covers have unique private keys. They receive no published catalogue links until atomic publication. A lost database completion response never causes the uploaded object to be deleted; an unselected orphan can remain after an ambiguous outcome.

A curator replacement supplies the whole accepted release and is inherited when another track enters that album. Original artist cover records and permissions are retained separately. Existing curator artwork is recognized for older catalogue drafts. Private audio preparation can proceed while artwork is missing; publication still requires the verified fixed-profile streaming derivative, a ready cover, complete discovery metadata, exact accepted lineage and a complete ordered release.

## Validation and rollout

Focused migrated PostgreSQL journeys cover pre-acceptance metadata correction, unchanged original records, stale edit rejection, append-only history, legacy encoding without artwork, publication rejection while cover is missing, curator replacement after audio preparation, album-cover inheritance, exact accepted lineage, stale publication confirmation, atomic publication and retry. Focused service/action checks cover actual image dimensions, native checksum verification, small-cover resizing, authenticated cover access, cross-origin rejection, explicit permission and preservation after an unknown commit result.

Forward migration **0015_curator_submission_editing.sql** adds a release description and curator artwork association, protects correction history and separates preparation from the artwork publication gate. It was tested on isolated migrated PGlite PostgreSQL. The strict database inventory expects 40 tables, 67 foreign keys and 16 migrations; no assertions are skipped. Apply 0015 to the identified target before deploying this code. No production migration, reset, seed or manual image assignment is part of this increment. Human UAT remains with the maintainer.

This continues the maintainer's **SOLO exception**. No Village agents, independent review or human editorial acceptance are claimed. Cloudflare must be managed through API/CLI; any website UI step requires asking first. Direct attachment work was stopped at the maintainer's request. The human supplies artwork through these tools after rollout.
