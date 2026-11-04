# Full-site design preview

The `sunsyn-curator-preview` Cloudflare Pages project builds `npm run build-storybook`
and publishes `storybook-static`. That output now serves the real SunSyn public
application at `/`, with the component catalogue retained at `/storybook/`.

This preview uses the actual application routes, server rendering, navigation,
search, theme switching, queue and audio player. It is visibly labelled as a
design preview using the repository's sample catalogue. It is not connected to
the production database, private media, Access identity, publishing or email.

## Build and inspect

```sh
npm run build-storybook
npm run test:site-preview
```

`build-storybook` first builds the component catalogue, then packages the full
site using `scripts/build-site-preview.mjs`. Its separate React Router build
directory is `build/site-preview`, selected only by the script's
`SUNSYN_SITE_PREVIEW_BUILD=1`. Production `npm run build` continues to use `build/`
and `workers/app.ts`. The script restores Wrangler's prior deployment pointer
after packaging, so it does not change the production deployment target.

`wrangler.site-preview.jsonc` selects `workers/site-preview.ts` only in Vite's
`site-preview` mode. This entry creates a static catalogue context and renders
the real public routes. It has no database, bucket, signing secret, scheduler,
identity or mutation repositories. Test identity/scenario headers do not activate
the production test harness. Invitation, private API and signed-media routes
return 404; mutations return 405. Curator design screens are a separate preview-only
route composition, described below. Analytics posts are discarded with 204 so sample
listening never records production analytics. The preview is excluded from search
indexing through robots.txt and X-Robots-Tag.

The output uses Cloudflare Pages advanced mode: `_worker.js/` holds the server
module graph, public assets are copied from the preview client build, and
`_routes.json` keeps hashed assets and `/storybook/*` on static serving. No
production Cloudflare project settings, routes, bindings or credentials change.

## Validation

The dedicated Pages-runtime browser checks exercise actual audio playback across
navigation, server-backed search, direct entity routes, no browser errors,
noindex headers, mutation/private-route rejection (including spoofed test
identity), and the retained Storybook index. The Pages test server starts outside
the repository configuration tree to avoid inheriting production Wrangler settings.

## Curator preview

Open `/curator` for the sample catalogue and `/curator/submissions` for the sample
submission queue. Review/scoring, submission editing and release preparation reuse
the production UI components. Buttons change browser-local demo state or show an
explicit “Preview only” notice; they do not submit decisions, send messages, upload
files or publish releases. Refresh resets local demo state.

Only the `SUNSYN_SITE_PREVIEW_BUILD=1` route manifest replaces the authenticated
curator routes with `curator-site-preview.tsx`. The normal production route manifest,
Access checks and backend handlers are unchanged. No synthetic identity is passed to
production authorization. Sample prepared-audio URLs are mapped only for the three
known `sample-0`/`sample-1`/`sample-2` IDs to an existing public fixture recording;
other private audio URLs remain unavailable.

The catalogue, queue, review, metadata editor and preparation screens can be inspected
here without signing in. Insights and catalogue administration explain that a live
backend requires authenticated staging; they do not invent analytics or expose tools.
The component catalogue remains available at `/storybook/`.
