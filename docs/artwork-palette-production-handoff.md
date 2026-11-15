# Artwork palette production handoff

The current site derives a constrained palette from cover art in the browser for the featured card and artist/release pages. It does not persist generated palettes. Manual palettes in `app/design-system/visual-identity.ts` take precedence; the selected site skin provides the fallback. This is a visual prototype, not the durable production pipeline.

## Prompt for the repository maintainer's AI

Implement durable artwork palettes for SunSyn's live catalogue. Preserve existing routes, playback, light/dark mode, skin selection, and manually reviewed identity palettes.

1. Inspect `artwork_assets`, its release/artist/track links, the R2 upload completion and publication paths, and existing Drizzle migration conventions. Store a versioned generated palette per artwork asset (semantic accent, light/dark paper, surface, and readable ink). Keep optional human overrides separately; an override must win without overwriting the generated result.
2. Use deterministic image extraction with downsampling and a contrast check. Accept the supported artwork MIME types. Derive colors from the final publishable artwork, not the private master. Keep image processing out of page requests. If extraction fails, retain the site-skin fallback and record a concise failure status.
3. Integrate extraction when a new publishable cover is finalized or replaced. Prevent stale output from an older cover being applied after replacement. Return validated palette data in public catalogue queries, and use it on the featured card and artist/release pages. Keep the current browser extraction only as a transitional fallback or remove it once the server path is complete.
4. Add an idempotent backfill command for existing production artwork. It must default to dry run, report the target environment and counts, process distinct artwork assets once, skip already current palettes and human overrides, support bounded batches/resume, and report failures without aborting the whole run. Do not run it against production as part of implementation.
5. Review the migration and extraction results on an isolated development database. Verify light/dark contrast, shared artwork, missing artwork, invalid image data, cover replacement, manual override, reruns, and existing catalogue behavior. Provide the exact deployment order: migration, application, dry run, reviewed write run, and verification query. Ask the human before the production write run.

Use the repository's Direct workflow only if the machine-local instruction activates it; otherwise follow its active workflow contract.
