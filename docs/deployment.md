# Deployment

This is a static website project for **sunstrucksynapse.com**.

## Recommended production domain

Use **sunstrucksynapse.com** as the primary production domain.

## Cloudflare Pages

1. Connect the GitHub repository in Cloudflare Pages.
2. Set framework/build preset to **None** (static site).
3. Build command: leave empty.
4. Output directory: `.` (repository root for direct static files).
5. Configure custom domain: `sunstrucksynapse.com`.
6. Enable HTTPS and enforce redirects as needed.

## Netlify

1. Create a new site from Git in Netlify.
2. Build command: leave empty.
3. Publish directory: `.` (repository root; or leave blank for static files).
4. Configure custom domain: `sunstrucksynapse.com`.
5. Enable HTTPS and set any redirect rules if required.

## Vercel

1. Import the GitHub repository into Vercel.
2. Framework preset: **Other** (no framework).
3. Build command: leave empty.
4. Output directory: `.` (repository root for static files).
5. Add custom domain: `sunstrucksynapse.com`.
6. Confirm SSL and domain verification.

## Generic static hosting

For any static host:

1. Upload repository root contents (`index.html`, `styles.css`, `script.js`, and `assets/`).
2. Set document root to where `index.html` lives.
3. Configure the custom domain to `sunstrucksynapse.com`.
4. Ensure HTTPS is enabled.
5. Add caching headers and compression if available.
