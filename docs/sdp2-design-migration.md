# SDP-2 production design migration

## Scope and authority

Maintainer instruction: create a branch and implement the new design in full; SDP-2 is the new design leader and the old design may be dropped. Work is direct/solo under the maintainer's explicit instruction not to run the Village. Branch: `agent/sdp2-production-design`. No merge, deployment or publishing is included.

Design source: [Kobold-Technologies/sdp-2](https://github.com/Kobold-Technologies/sdp-2) at `005de64c5502c13d8c1e3298156127656cc5ad25`. Source design reference and inventory are authoritative for palette, interface/display fonts, surfaces, media emphasis and shared control geometry. The prior SunSyn broadcast/paper appearance is retired.

## Source reuse

`app/design-system/sdp2/{palette,theme}.css` preserve source token names/values and recipes. The sole structural adaptation changes `.kb-preview` to `:where(:root, [data-theme])`, allowing production documents and independent light/dark Storybook frames to consume the same system. Prettier formats the copies. The complete source file hashes remain recorded in `design-mockup/upstream-manifest.json`.

Local Inter and Orbitron woff2 files come from the same Fontsource 5.3.0 packages as SDP-2. Their OFL copyright/license notices ship in `app/design-system/fonts/`. No external font host, new runtime package or source backend is required.

Source reuse notices: [scoped reuse](https://github.com/Kobold-Technologies/sdp-2/blob/main/docs/STORYDIRECTOR-REUSE.md) and [extraction](https://github.com/Kobold-Technologies/sdp-2/blob/main/docs/EXTRACTION.md). This implements the maintainer-authorized adaptation; it does not grant a new general license to the source project.

## Production changes

- Shared palette/theme bridge replaces every former warm-paper/ink primitive with SDP-2 roles. Existing component-variable names remain compatibility contracts, not an alternate palette.
- Local Inter/Orbitron replace condensed, mono and handwritten presentation. Legacy metadata/font aliases now resolve to Inter.
- Listener header gains a reusable headphone StationMark and the source gradient wordmark.
- RadioStart consumes real published collection content and renders the new display hierarchy and SignalIllustration. Its play callback still uses the real finite listening selection and existing playback coordinator.
- The homepage adds an editorial composition beside the real catalogue. Releases retain their own artwork, credits and links. No mockup catalogue, generated rights/disclosure metadata or synthetic statistics ship.
- Search, entity routes, track actions, queue, persistent dock, full player, menus and dialogs consume the new recipes.
- Submission forms/uploads/notices, curator catalogue/review/publication controls and panels, About, policy and contact surfaces share the new production foundation.
- Storybook imports the same production styles and components. Foundations document the revised palette roles, spacing and typography.
- Theme resolution, persistence, pre-paint initialization and theme-color metadata remain coordinated. Native dialog, queue Undo/reordering, signed-media delivery, player identity and authorization remain existing production behavior.

## Components added beyond SDP-2

- `StationMark`: reusable native SVG music identity; used by public and curator headers.
- `SignalIllustration`: static source-palette frequency artwork, hidden from assistive technology; no animation or simulated playback data.
- Music landing composition: real RadioStart and track-list section plus the editorial note; no provider work or fixture data.
- SunSyn production recipes for track rows, transport dock, queue/current-track surfaces, native player sheet and responsive music/entity layouts.

These extend SDP-2's creative-workspace system to the listening domain. They do not import its filmmaking graph, generation workflow or stores.

## Added/completed tokens

The source palette is unchanged. SunSyn's token bridge adds music roles: `--color-accent-primary`, `--radio-content-width`, `--radio-hero-type-size`, `--radio-hero-illustration-height`, `--radio-transport-background`, `--radio-row-divider`, `--radio-artwork-radius`, `--radio-illustration-core`, `--radio-illustration-halo`, `--radio-illustration-ring`, and `--radio-illustration-wave`.

The completed SunSyn spacing scale is 4/8/12/16/24/32/40/48px, with 8px small corners, the source 12px control corners and 24px panels/dialogs. These are explicit SunSyn extensions where SDP-2 has no complete system-wide scale.

SDP-2 only partially defines light mode. The bridge completes field, placeholder, dialog, text, border, status and music illustration roles so every production workflow continues to support the existing theme toggle. Source media hues use their provided darker light-mode variants; light-mode brand text uses stronger hues for readable contrast. High-contrast is not a newly supported product theme.

## Validation

- Type generation and strict TypeScript build: passed.
- ESLint, Prettier and `git diff --check`: passed.
- Unit suite: 48 files / 327 tests passed.
- Encoder suite: 4 tests passed.
- Local PGlite migration/schema/seed/lifecycle validation and Drizzle migration check: passed.
- Production Worker/client build and final Storybook build: passed.
- Browser suite: all 82 tests passed across desktop Chromium, mobile Chromium, Firefox, desktop WebKit and mobile WebKit (67 Chromium/Firefox checks plus 15 WebKit checks).
- New design acceptance checks cover actual primary-action AA text contrast, visible keyboard focus, no horizontal overflow and the first-screen play action at 1440/390/320px in light/dark mode, across the three desktop engines.
- Production visual review captured dark/light homepages, a narrow phone and the curator catalogue under `design-mockup/review/production-*.png`. Selected curator-grade text was inspected with real production controls in both themes: dark ink on audio blue in dark mode, light ink on deep audio blue in light mode.

WebKit initially could not launch from a newly downloaded browser cache. The managed environment already has a configured installation with verified library links. The successful WebKit run used `PLAYWRIGHT_BROWSERS_PATH=/workspace/.onboarding/browsers`, `LD_LIBRARY_PATH=/workspace/.onboarding/sysroot/usr/lib/x86_64-linux-gnu`, `XDG_CACHE_HOME=/var/tmp` and `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`. The last setting bypasses only the ldconfig-cache heuristic after directly verifying the shared libraries; no browser assertions were skipped or weakened.

Browser evidence uses the repository's isolated test-mode Worker and synthetic catalogue/curator fixtures. It does not establish production catalogue availability or deployed authorization/media behavior. Native phone background audio and a complete assistive-technology audit remain device/human acceptance checks. These checks are solo-review evidence, not independent Village acceptance. No schema, service, provider or publication-policy changes were made.
