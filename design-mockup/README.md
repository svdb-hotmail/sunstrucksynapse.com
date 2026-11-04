# SunSyn Radio — SDP-2 design mockup

Standalone, interactive design preview. SDP-2 is the new visual authority; no legacy SunSyn design tokens, styles or components are imported. Existing audio files provide real local playback. This does not replace the production application.

## Open

```sh
npm run mockup
```

Visit http://localhost:5174/. The mockup is served separately from the production application. Build and type-check it with `npm run build:mockup`. No database, secrets, providers or deployment are required.

Try Start listening, Explore/search, track titles, queue additions/removal, and the bottom transport. Playback continues when switching mockup views. The two recordings are existing public local assets. New artwork and editorial copy are illustrative. Queue/search state resets on refresh.

## Design source

Source: https://github.com/Kobold-Technologies/sdp-2 at `005de64c5502c13d8c1e3298156127656cc5ad25`.

`upstream/` contains source palette/theme/brand CSS, shared control CSS, Button/ButtonBase, MediaButton and Notice/NoticeBase. These are direct copies, not visually reconstructed approximations. The only source adaptation removes an unused `@tailwind base` directive; a small isolated reset is supplied locally. The actual source Inter and Orbitron font package versions (5.3.0) are served locally. Font OFL notices are in `fonts/`. File origins, hashes and adaptation are recorded in `upstream-manifest.json`.

The new music compositions consume those source recipes. Additional role tokens and layout rules live in `mockup.css`. Native range controls and the native track-detail dialog retain browser interaction semantics while consuming source colors/surfaces. SDP-2's general brand buttons, audio-media emphasis and notice presentation remain source implementations.

Source reuse/provenance notices: https://github.com/Kobold-Technologies/sdp-2/blob/main/docs/STORYDIRECTOR-REUSE.md and https://github.com/Kobold-Technologies/sdp-2/blob/main/docs/EXTRACTION.md. The user's instruction authorizes this mockup adaptation; no new general license or production distribution rights are asserted.

## Additions and boundaries

See [ADDITIONS.md](ADDITIONS.md) for every new component/pattern, the exact added token names, and remaining production work. This mockup implements the source dark design. It does not invent complete light/high-contrast mappings or claim full accessibility acceptance.

## Validation

- Isolated TypeScript check and Vite production build.
- ESLint for the authored TypeScript entry and Vite config.
- Chromium inspection at desktop, 390px and 320px, including overflow checks.
- Real local playback, next queued track, pause, search/no-results, modal/Escape, queue add/remove and duplicate handling.
- No browser page errors in the checked journey.

Review captures are in `review/`. The source application, backend, catalogue records, published site and environment configuration are unchanged.
