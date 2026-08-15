# Content Integration Guide

Use this guide when replacing placeholder website content.

## Replace placeholder media references

- Replace placeholder thumbnails in `public/assets/` with final optimized thumbnails while preserving public URLs.
- Update temporary catalogue records in `app/data/catalogue.ts`; page components must not contain catalogue item literals.
- Keep the visual player source-free until the catalogue and streaming work in #12 provides real media URLs.

## Keep preview media separate from master files

Keep optimized public preview media in this repository, and store large original/master files separately (local archive, private storage, or production media pipeline).

## Suggested folders

Use these folders under `public/assets/`:

- `public/assets/images/`
- `public/assets/thumbs/`
- `public/assets/posters/`
- `public/assets/audio/`
- `public/assets/video/`
