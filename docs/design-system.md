# SunSyn Radio design system

This document describes the visual and interaction contract for SunSyn Radio. The
repository is the source of truth: production components and their CSS define the
implemented experience. Storybook is a visual catalogue and development aid, not a
second component implementation.

SunSyn Radio is the platform name and `https://sunsyn.art` is the canonical public
domain. **Sunstruck Synapse** remains the artist/catalogue identity in existing
artist records, track titles, media filenames, fixtures and seeds, rights and
disclosure notes, and historical architecture or repository identifiers. A visual
or copy change must not rename those data values.

## Architecture

The design-system surface has three layers in `app/design-system/tokens.css`:

1. **Primitives** are the raw palette, typography, spacing, radius, border, shadow,
   and motion values. They are the smallest reusable choices, such as a color step
   or spacing unit, and do not describe a component or page.
2. **Semantic tokens** describe intent and meaning: page background, surface,
   text, muted text, border, accent, focus ring, success, warning, and danger.
   Components should consume semantic tokens rather than reaching into the raw
   palette.
3. **Component tokens** are aliases for repeated component contracts, such as a
   control background, player-panel surface, or card radius. Add one only when it
   makes a component's contract clearer or keeps repeated values coordinated.

Token names should describe role, not appearance. The layer prefixes make the
ownership clear: use `--primitive-*` for raw values, `--color-*` for semantic
colour roles, and `--component-*` for component aliases. For example,
`--color-surface-panel`, `--color-content-secondary`, and
`--component-control-background` describe intent; names such as `--purple` or
`--dark-gray` do not.
Keep values in the token file; do not add one-off hex colors, shadows, radii, or
spacing literals to production component styles when a token expresses the role.
Use the existing global styles as the migration boundary: production components
remain in `app/components`, while token definitions become the shared visual
vocabulary.

The compatibility aliases (`--bg`, `--panel`, `--text`, and related names) keep
existing selectors stable while styles move onto semantic and component tokens.
New styles should use the prefixed names; do not add more compatibility aliases.

### Dark and light themes

Primitive values are stable design choices. Theme changes map semantic roles to
different values, so components do not need separate dark and light branches. The
dark mapping is the default and preserves the current listening experience; the
light mapping must retain readable text, visible boundaries, and a clear focus
indicator. Theme-specific overrides belong on the semantic layer (for example,
`[data-theme="light"]`), not as ad hoc component exceptions.

`app/config/brand.ts` is the canonical runtime identity for document and route
metadata. Use its exported site name, short name, description, and URL instead of
duplicating platform strings in components or stories. It does not rewrite artist,
track, fixture, seed, or rights data.

## Theme behavior

`app/design-system/theme.ts` owns theme parsing, resolution, persistence, and the
pre-paint initialization script. The resolution order is:

1. A valid explicit value saved under `sunsyn-radio-theme-v1`.
2. The browser's `prefers-color-scheme` preference.
3. The stable `dark` default when neither is available.

The initializer applies `data-theme="light"` or `data-theme="dark"` to the root
`html` element before React paints and keeps the `theme-color` metadata in sync.
This avoids a theme flash while remaining safe for server rendering. Browser-only
objects (`window`, `document`, `localStorage`, and `matchMedia`) must be read from
effects or guarded helpers, never during a server render.

The accessible `ThemeToggle` is a real button with an explicit accessible name,
pressed state, visible focus treatment, and keyboard activation. It switches the
explicit preference and persists it when storage is available. If storage is
blocked or unavailable, the toggle still applies for the current page session.
When there is no saved preference, a system-theme change may update the page; an
explicit user choice takes precedence over later operating-system changes.

## Component reuse and Storybook

Production components stay in `app/components` and are the only implementation to
fix. A story imports those components and the production CSS; it should provide
small, deterministic catalogue fixtures or props and must not copy component
markup or styling into a Storybook-only version.

Storybook uses an isolated, client-only Vite configuration. Stories must not import
the Worker entry, server routes, database repositories, Cloudflare bindings,
private-media services, or deployment environment values. If a component requires
runtime data, provide a typed fixture at the story boundary. Keep stories
network-free and safe to run without production credentials.

Use the repository's Storybook scripts:

```bash
npm run storybook
npm run build-storybook
```

The first command opens the interactive visual catalogue; the second creates its
static build for inspection. These commands document local development only and do
not imply that Storybook is a deployment target. When a component changes, update
the production component and its stories together. If Storybook and the running
application disagree, the production component and repository CSS win.

## Contribution guidance

Do:

- Start with an existing semantic token and add a new token only for a stable,
  reusable role.
- Reuse production components and existing interaction patterns.
- Check both dark and light mappings, keyboard flow, focus visibility, reduced
  motion, narrow layouts, and long labels/content.
- Keep platform copy on SunSyn Radio while preserving catalogue and artist data.
- Add a story for meaningful states: default, loading, empty, error, disabled,
  selected, and long-content variants where applicable.

Do not:

- Hard-code a palette value in a component to work around a theme mapping.
- Create a Storybook-only component that can drift from production.
- Use color as the only status or interaction cue.
- Make browser storage or media-query access a render-time requirement.
- Treat Storybook appearance as evidence that a Worker, database, or private-media
  boundary works.
- Rename `Sunstruck Synapse` values that identify artist/catalogue data or history.

## Accessibility expectations

Every control needs an accurate accessible name, a keyboard-operable interaction,
and a visible `:focus-visible` indicator. Text and essential controls must maintain
at least WCAG AA contrast against their themed surfaces. State must be conveyed by
text, structure, or an announced attribute as well as color. Use semantic headings,
landmarks, labels, and button/link elements; preserve logical focus order and do
not remove the browser's focus outline without a stronger replacement.

Respect `prefers-reduced-motion` for transitions, scrolling, and decorative motion.
Do not rely on hover-only information, tiny hit areas, or an icon without a label.
Verify light and dark themes with zoomed text, keyboard-only navigation, screen
reader names for icon controls, and error/disabled states. A story can document an
accessible state, but the production component owns the behavior.

## Naming boundary at a glance

| Use                          | Name or value                                                |
| ---------------------------- | ------------------------------------------------------------ |
| Current platform and UI copy | SunSyn Radio                                                 |
| Site mark                    | `SS`, from `SITE_MARK` in `app/config/brand.ts`              |
| Canonical public domain      | `sunsyn.art`                                                 |
| Artist/catalogue identity    | Sunstruck Synapse                                            |
| Runtime identity source      | `app/config/brand.ts`                                        |
| Theme and token source       | `app/design-system/theme.ts`, `app/design-system/tokens.css` |
| Production component source  | `app/components`                                             |
| Visual catalogue             | Storybook stories using production components                |
