# Content Integration Guide

Use this guide when adding or replacing catalogue content.

## Add catalogue media references

- Add optimized publishable derivatives under `public/assets/` while preserving stable public URLs.
- Add artist, release, track, artwork, and publishable media metadata through the database seed or curator workflow. Page components must not contain production catalogue item literals.
- Keep private masters out of public paths. Public repository queries expose only `publishable_derivative` asset records.

## Keep preview media separate from master files

Keep optimized public preview media in this repository, and store large original/master files separately (local archive, private storage, or production media pipeline).

## Suggested folders

Use these folders under `public/assets/`:

- `public/assets/images/`
- `public/assets/thumbs/`
- `public/assets/posters/`
- `public/assets/audio/`
- `public/assets/video/`
