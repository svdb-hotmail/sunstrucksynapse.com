# SunSyn additions to SDP-2

SDP-2 is the design authority. This mockup imports no SunSyn production CSS or design tokens. Its palette, Inter/Orbitron typefaces, surfaces, general buttons, media buttons and notices come from SDP-2. Dark theme only: light and high-contrast versions are not claimed.

## Components missing from SDP-2, created for this mockup

| Component/pattern                        | Implemented behavior                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Radio masthead and navigation            | SunSyn identity using source gradient display type and icon badge; Listen/Explore/Queue tabs and queue count.      |
| Listening-selection hero                 | Music-focused composition using source panel and media-action recipes; starts actual audio and replaces the queue. |
| Frequency illustration and track artwork | New static artwork using only SDP-2 palette hues; explicitly illustrative, not catalogue artwork.                  |
| Track row and track list                 | Title/artist, artwork, current play/pause state, play action and queue/remove action.                              |
| Curator note                             | Editorial composition using source project-surface and project-border roles.                                       |
| Track discovery tile                     | Artwork/title presentation and entry to track details. These are tracks, not invented releases.                    |
| Persistent audio transport               | Native audio element, play/pause, restart, next, elapsed/duration, seeking, volume and queue access.               |
| Queue view                               | Add/remove/clear, duplicate guard, empty state and automatic advance.                                              |
| Catalogue search                         | Local title/artist search and no-results recovery.                                                                 |
| Track-detail dialog                      | Native modal with source dialog surface/border/backdrop, artwork, play and enqueue actions.                        |
| Listener empty and error states          | Empty queue, unmatched search, audio load/play errors and source Notice feedback.                                  |
| Responsive music layout                  | Desktop composition plus 390px/320px phone layouts, with the same native audio element.                            |

The mockup keeps these compositions in main.tsx for review; it does not claim a published reusable component API. Icon and Artwork are shared local primitives. No invented provenance/rights metadata is presented.

## Tokens missing from SDP-2, introduced locally

All new tokens use `--radio-*` in `mockup.css`. No changes to upstream tokens. These additions supply music-specific roles and the spacing/type scales that SDP-2 does not yet expose as a complete shared system.

- `--radio-content-width`
- `--radio-header-height`
- `--radio-transport-height`
- `--radio-gutter`
- `--radio-section-gap`
- `--radio-panel-radius`
- `--radio-artwork-radius`
- `--radio-row-height`
- `--radio-text-secondary`
- `--radio-text-body`
- `--radio-playback-accent`
- `--radio-track-divider`
- `--radio-transport-background`
- `--radio-scrubber-track`
- `--radio-scrubber-thumb`
- `--radio-dialog-backdrop`
- `--radio-hero-surface`
- `--radio-art-signal`
- `--radio-art-bloom`
- `--radio-space-1`
- `--radio-space-2`
- `--radio-space-3`
- `--radio-space-4`
- `--radio-space-5`
- `--radio-space-6`
- `--radio-type-caption`
- `--radio-type-small`
- `--radio-type-body`
- `--radio-type-section`
- `--radio-type-hero`

Colors derive from SDP-2 palette or semantic roles. New geometry, typography sizes and responsive breakpoints are mockup decisions, not existing SDP-2 standards. Illustration gradients compose source hues. Source token ownership and imported-file hashes are recorded in upstream-manifest.json.

## Remaining production work

- Map these patterns to real catalogue repositories, real editorial content and artist/release routes.
- Integrate the existing playback coordinator, signed-media refresh, persistent queue, Media Session and restoration behavior.
- Decide reusable component APIs and add production interaction/state stories.
- Define complete light/high-contrast mappings, then verify them across screens.
- Add full-player/mobile queue access, keyboard queue reordering and Undo if retaining those product capabilities.
- Native phone background audio, assistive-technology and cross-browser acceptance.

This is a standalone design mockup, not a replacement production application. Queue and search are in memory; refresh resets them. Existing local recordings are used for real playback; metadata, artwork and editorial copy are preview fixtures. No publishing, backend or authorization changes.
