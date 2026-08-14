# Sunstruck Synapse Radio

Sunstruck Synapse Radio is intended to become a human-curated listening destination for intentional AI-assisted music:

> Exceptional music made with AI in the process, selected by humans.

Music quality, deliberate human selection, and clear creative-process context define the product. "AI-assisted" describes a range of creative methods; it is not a genre or a substitute for editorial judgment.

## Current repository state

This repository currently contains a static HTML, CSS, and JavaScript prototype inherited from an earlier audio-and-video portfolio concept. It demonstrates a streaming-style layout with placeholder catalogue entries and client-side interactions.

It is not yet the intended product. In particular, the repository does not currently provide a real music catalogue, continuous playback, artist submissions, curator administration, rights or provenance records, search, analytics, or other platform services. The prototype remains deployable as a static site with no framework, build pipeline, package manager, or application backend.

## Intended product

Sunstruck Synapse Radio will be the public listening, editorial, and curation product for carefully selected AI-assisted music. It is for listeners seeking considered work, artists using AI as part of an intentional creative process, and curators assessing musical quality, rights information, and creative-process disclosures.

The MVP is curator-led and invitation-oriented. Publication will require deliberate human editorial selection rather than automated ranking or unrestricted uploading.

See the [product scope, terminology, and non-goals](docs/product-scope.md) for the complete definition.

## MVP boundary

The intended MVP centres on a curated catalogue, real continuous audio playback, queue and playback controls, artist/release/track pages, editorial collections, search and filtering, curator administration, structured submissions, rights and creative-process declarations, basic privacy-conscious analytics, and a responsive, accessible web experience.

These are planned capabilities, not descriptions of the current prototype. The MVP excludes open self-publishing, royalty accounting, advertising, native mobile applications, algorithmic recommendation feeds, social features, automated AI-quality scoring, DRM, payments, and a public video catalogue.

## Future possibilities

Later phases may evaluate broader creator workflows, richer provenance integrations, additional presentation formats, or capabilities associated with LEMM. These are possibilities rather than commitments. The Sunstruck Synapse Radio MVP will not depend technically on future LEMM infrastructure, and this repository does not contain LEMM functionality.

## Repository structure

```text
sunstrucksynapse.com/
|-- index.html
|-- styles.css
|-- script.js
|-- README.md
|-- LICENSE
|-- .gitignore
|-- assets/
|   |-- favicon.svg
|   |-- thumbs/
|   |-- posters/
|   |-- audio/
|   `-- video/
`-- docs/
    |-- product-scope.md
    |-- deployment.md
    |-- media-protection.md
    |-- content-guide.md
    `-- cloudflare-setup.md
```

## Local preview

From the repository root, use any simple static server. For example, with Python 3:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Documentation

- [Product scope, terminology, and non-goals](docs/product-scope.md)
- [Deployment guidance](docs/deployment.md)
- [Content integration guide](docs/content-guide.md)
- [Media protection notes](docs/media-protection.md)
- [Cloudflare configuration guide](docs/cloudflare-setup.md)

## Media warning

Do not commit large original or master media files unless intentional. Keep source exports in local or offline storage or dedicated private storage, and commit only optimized public web assets.
