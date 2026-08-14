# Cloudflare Configuration Guide

This guide documents the recommended Cloudflare settings for **sunstrucksynapse.com** to balance performance, security, and media protection.

The application now targets Cloudflare Workers rather than a static Pages upload. This document is advisory only: production account changes, deployment, bindings, and secrets remain outside the application migration. Revalidate every caching recommendation against route-specific behavior before enabling it.

## Recommended Settings

### Security & Performance (Enable)

| Setting | Path | Why | Impact |
|---------|------|-----|--------|
| **Always Use HTTPS** | SSL/TLS → Overview | Forces all traffic over HTTPS | Required for browser security and protection headers |
| **Automatic HTTPS Rewrites** | SSL/TLS → Edge Certificates | Rewrites legacy `http://` asset references to `https://` | Helps prevent mixed-content warnings if old absolute asset URLs are introduced |
| **HTTP/3 (QUIC)** | Network → HTTP/3 | Faster connection protocol | Improves page load speed; no security downside |
| **Brotli Compression** | Speed → Optimization → Brotli | Compresses text/CSS/JS smaller than gzip | Reduces bandwidth; especially good for CSS/JS payloads |
| **Early Hints** | Speed → Optimization → Early Hints | Preloads critical resources | Marginal perf gain; validate against the built Worker application |
| **Minify (HTML, CSS)** | Speed → Optimization → Auto Minify | Removes whitespace from markup and styles | Saves bandwidth on first load; enable JS minify only after testing site interactivity |

### Hotlink Protection (Images Only)

| Setting | Path | Why | Impact |
|---------|------|-----|--------|
| **Hotlink Protection** | Scrape Shield → Hotlink Protection | Blocks supported image requests from external sites | Helps protect public image assets such as thumbnails and posters |
| **Hotlink Protection Whitelist** | _(same)_ | Allow specific referrers (e.g., your own domains) | Optional; only if you want to allow cross-domain image embeds |

*Note: Cloudflare Hotlink Protection is for common image formats such as GIF, ICO, JPG, JPEG, and PNG. It does not protect public MP3/MP4 URLs. Before uploading real audio or video, use private storage plus signed URLs, Workers, Stream, or custom WAF logic for media delivery.*

### Cache & TTL (Recommended)

| Setting | Path | Why | Impact |
|---------|------|-----|--------|
| **Browser Cache TTL** | Caching → Browser Cache TTL | Set an appropriate TTL for versioned public assets | Do not apply one policy to route responses and immutable assets |
| **HTML route caching** | Caching → Cache Rules | Defer broad HTML caching until route-specific data policies exist | Prevents future personalized or frequently updated route output from being cached incorrectly |
| **Authenticated Content Rule** | Rules → Page Rules or Caching → Cache Rules | Bypass cache for authenticated paths if future login is added | Prevents accidental caching of personalized content |

### Security Headers (Recommended)

| Setting | Path | Why | Impact |
|---------|------|-----|--------|
| **Strict Transport Security (HSTS)** | SSL/TLS → Edge Certificates → HSTS | Enable with 6-month max-age after HTTPS is confirmed | Forces browsers to always use HTTPS; protects against downgrade attacks |
| **X-Content-Type-Options** | Rules → Transform Rules → Modify Response Header, or origin headers | Set to `nosniff` | Prevents MIME-type sniffing attacks |
| **X-Frame-Options** | Rules → Transform Rules → Modify Response Header, or origin headers | Set to `DENY` if no iframe embedding intended | Prevents clickjacking if you don't embed on other sites |

*Note: Cloudflare WAF rules do not add response headers. Configure response header modifications with Transform Rules or set headers at the origin, then verify them in browser dev tools.*

### Do NOT Enable (unless you have a specific reason)

| Setting | Reason |
|---------|--------|
| **Bot Fight Mode (Free tier)** | Blocks legitimate traffic; overly aggressive for a portfolio site |
| **Challenge (CAPTCHA)** | Will frustrate visitors viewing portfolio; use only if bot traffic is heavy |
| **Rate Limiting Rules** | Not needed for static content; use only if you add a contact API endpoint later |
| **Rocket Loader** | Can break dynamic JS on portfolio (e.g., your media card selection); not recommended |
| **Mirage** | Image optimization; can interfere with thumbnails; keep off unless needed |
| **Auto Minify (JS only)** | The Vite build already optimizes the application bundle; avoid secondary transformations unless the built interactions are revalidated |

---

## Setup Checklist

### Phase 1: Core Security (Do First)

- [ ] Go to SSL/TLS → Overview
  - [ ] Set SSL/TLS encryption to "Full (strict)"
  - [ ] Enable "Always Use HTTPS"
  - [ ] Enable "Automatic HTTPS Rewrites"
  - [ ] Enable "HTTP Strict Transport Security (HSTS)" with max-age ≥ 6 months

- [ ] Go to Speed → Optimization
  - [ ] Enable "Brotli"
  - [ ] Enable "Auto Minify" → Check HTML and CSS
  - [ ] Enable JS minify only after confirming the media controls still work
  - [ ] Enable "Early Hints"

- [ ] Go to Network
  - [ ] Enable "HTTP/3 (with QUIC)"

### Phase 2: Caching (After Phase 1)

- [ ] Go to Caching → Cache Rules
  - [ ] Define rules only after route and asset caching requirements are documented
  - [ ] Do not cache all Worker HTML by default

- [ ] Go to Caching → Browser Cache TTL
  - [ ] Set to "30 minutes"

### Phase 3: Media Protection

- [ ] Go to Scrape Shield → Hotlink Protection
  - [ ] Enable "Hotlink Protection" for public image thumbnails/posters
  - [ ] Optionally whitelist your own domain/subdomain for image embeds

- [ ] Before uploading real audio or video
  - [ ] Use private storage plus signed URLs, Workers, Stream, or custom WAF logic
  - [ ] Do not rely on Hotlink Protection for MP3/MP4 files

### Phase 4: Future (When adding APIs or authentication)

- [ ] Create WAF Rules to rate-limit form submissions / API calls
- [ ] Add Page Rules for authenticated content (if login implemented)
- [ ] Consider Workers for media delivery from private R2

---

## Notes

1. **Contact Form**: The current `mailto:` form is not mixed content, but it depends on the visitor's local email client and can fail or feel awkward. Replace it with a proper API endpoint (e.g., Cloudflare Workers + Resend/SendGrid) in a future update.

2. **Media Delivery**: The player is intentionally source-free. Public presentation assets live in `public/assets/`; before adding real media, implement the later catalogue and private-delivery work described in `media-protection.md`.

3. **Testing**: After enabling settings, test in an incognito window to verify:
   - [ ] No mixed-content warnings
   - [ ] Page loads quickly
   - [ ] Media/image thumbnails display
   - [ ] Media mode toggle (Audio/Video buttons) works
   - [ ] Card selection and player update work

4. **Monitoring**: After each change, check Cloudflare Analytics for:
   - Cache hit ratio for cacheable public assets
   - Request counts (should be low if caching is working)
   - Worker and asset error rates

---

## References

- [Cloudflare SSL/TLS Setup](https://developers.cloudflare.com/ssl/get-started/)
- [Cloudflare Caching Docs](https://developers.cloudflare.com/cache/)
- [Cloudflare Speed Optimization](https://developers.cloudflare.com/speed/)
- [Media Protection Strategy](media-protection.md) (for future private media delivery)
