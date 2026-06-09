# sunstrucksynapse.com

Clean static website repository for **sunstrucksynapse.com**.

This project is intentionally simple: plain HTML, CSS, and JavaScript with no framework, build pipeline, or package manager requirements.

## Project overview

Use this repository as the destination for your static site zip contents and media assets. It is organized so you can drop website files into the repo root and keep media organized under `assets/`.

## Expected file structure

```text
sunstrucksynapse.com/
├── index.html
├── styles.css
├── script.js
├── README.md
├── LICENSE
├── .gitignore
├── assets/
│   ├── .gitkeep
│   ├── images/
│   ├── thumbs/
│   ├── posters/
│   ├── audio/
│   └── video/
└── docs/
    ├── deployment.md
    ├── media-protection.md
    └── content-guide.md
```

## Local preview

From the repository root, use any simple static server.

Python 3 option:

```bash
python3 -m http.server 8080
```

Then open: `http://localhost:8080`

## Where to place website files from the zip

Copy these files from your static website zip into the repository root:

- `index.html`
- `styles.css`
- `script.js`
- (optional) update `README.md` with project-specific details after import

## Where to place media assets

Place public website media under `assets/`, organized by type:

- `assets/images/`
- `assets/thumbs/`
- `assets/posters/`
- `assets/audio/`
- `assets/video/`

## Deployment notes

Deployment guidance is documented in [`/docs/deployment.md`](docs/deployment.md).

Recommended production domain: **sunstrucksynapse.com**

## Media warning

Do **not** commit large original/master media files directly unless intentional. Keep large source exports in local/offline storage or dedicated private buckets and only commit optimized public web assets.
