# Cloudflare Configuration Guide

This guide documents the recommended Cloudflare settings for **sunstrucksynapse.com** to balance performance, security, and media protection.

## Recommended Settings

### Security & Performance (Enable)

| Setting | Path | Why | Impact |
|---------|------|-----|--------|
| **Always Use HTTPS** | SSL/TLS → Overview | Forces all traffic over HTTPS | Required for browser security and protection headers |
| **Automatic HTTPS Rewrites** | SSL/TLS → Edge Certificates | Rewrites `http://` references to `https://` | Eliminates mixed-content warnings on contact form |
| **HTTP/3 (QUIC)** | Network → HTTP/3 | Faster connection protocol | Improves page load speed; no security downside |
| **Brotli Compression** | Speed → Optimization → Brotli | Compresses text/CSS/JS smaller than gzip | Reduces bandwidth; especially good for CSS/JS payloads |
| **Early Hints** | Speed → Optimization → Early Hints | Preloads critical resources | Marginal perf gain; safe for static sites |
| **Minify (HTML, CSS, JS)** | Speed → Optimization → Auto Minify | Removes whitespace from code | Saves ~10-15% bandwidth on first load |

### Hotlink Protection (Enable if serving media URLs directly)

| Setting | Path | Why | Impact |
|---------|------|-----|--------|
| **Hotlink Protection** | Speed → Caching → Hotlink Protection | Blocks image/media requests from external sites | If media is public, prevents others' sites from embedding your content |
| **Hotlink Protection Whitelist** | _(same)_ | Allow specific referrers (e.g., your own domains) | Optional; only if you want to allow cross-domain embeds |

*Note: Once you move to private R2 + Workers for media delivery, hotlink protection is less critical since URLs are short-lived and signed.*

### Cache & TTL (Recommended)

| Setting | Path | Why | Impact |
|---------|------|-----|--------|
| **Browser Cache TTL** | Caching → Browser Cache TTL | Set to `30 minutes` | Static portfolio doesn't change frequently |
| **Cache Level** | Caching → Cache Level | Set to `Cache Everything` | Safe for static sites; aggressive caching improves speed |
| **Page Rules** | Rules → Page Rules | Cache /index.html with `Cache on Cookie` if future login added | Prevents accidental caching of personalized content |

### Security Headers (Recommended)

| Setting | Path | Why | Impact |
|---------|------|-----|--------|
| **Strict Transport Security (HSTS)** | SSL/TLS → HSTS | Enable with 6-month max-age | Forces browsers to always use HTTPS; protects against downgrade attacks |
| **X-Content-Type-Options** | _(auto)_ | Should be `nosniff` (default) | Prevents MIME-type sniffing attacks |
| **X-Frame-Options** | _(via WAF Rules)_ | Set to `DENY` if no iframe embedding intended | Prevents clickjacking if you don't embed on other sites |

*Note: These are often set by default or via WAF rules; verify they are active.*

### Do NOT Enable (unless you have a specific reason)

| Setting | Reason |
|---------|--------|
| **Bot Fight Mode (Free tier)** | Blocks legitimate traffic; overly aggressive for a portfolio site |
| **Challenge (CAPTCHA)** | Will frustrate visitors viewing portfolio; use only if bot traffic is heavy |
| **Rate Limiting Rules** | Not needed for static content; use only if you add a contact API endpoint later |
| **Rocket Loader** | Can break dynamic JS on portfolio (e.g., your media card selection); not recommended |
| **Mirage** | Image optimization; can interfere with thumbnails; keep off unless needed |
| **Rocket Loader, Auto Minify (JS only)** | May break your `script.js` interactivity; test first if enabling |

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
  - [ ] Enable "Auto Minify" → Check HTML, CSS, JS
  - [ ] Enable "Early Hints"

- [ ] Go to Network
  - [ ] Enable "HTTP/3 (with QUIC)"

### Phase 2: Caching (After Phase 1)

- [ ] Go to Caching → Cache Level
  - [ ] Set to "Cache Everything"

- [ ] Go to Caching → Browser Cache TTL
  - [ ] Set to "30 minutes"

### Phase 3: Media Protection (If serving media URLs publicly)

- [ ] Go to Speed → Caching → Hotlink Protection
  - [ ] Enable "Hotlink Protection"
  - [ ] Optionally whitelist your own domain/subdomain

### Phase 4: Future (When adding APIs or authentication)

- [ ] Create WAF Rules to rate-limit form submissions / API calls
- [ ] Add Page Rules for authenticated content (if login implemented)
- [ ] Consider Workers for media delivery from private R2

---

## Notes

1. **Contact Form**: The current `mailto:` form will show a mixed-content warning on HTTPS. This is harmless but unprofessional. Replace with a proper API endpoint (e.g., Cloudflare Workers + Resend/SendGrid) in a future update.

2. **Media Delivery**: Current placeholders (`assets/audio/` and `assets/video/`) are served from Pages and are public. Before uploading real media, implement private R2 + signed URLs (see `media-protection.md` for details).

3. **Testing**: After enabling settings, test in an incognito window to verify:
   - [ ] No mixed-content warnings
   - [ ] Page loads quickly
   - [ ] Media/image thumbnails display
   - [ ] Media mode toggle (Audio/Video buttons) works
   - [ ] Card selection and player update work

4. **Monitoring**: After each change, check Cloudflare Analytics for:
   - Cache hit ratio (should be >80% for static site)
   - Request counts (should be low if caching is working)
   - Error rates (should be 0 for a static portfolio)

---

## References

- [Cloudflare SSL/TLS Setup](https://developers.cloudflare.com/ssl/get-started/)
- [Cloudflare Caching Docs](https://developers.cloudflare.com/cache/)
- [Cloudflare Speed Optimization](https://developers.cloudflare.com/speed/)
- [Media Protection Strategy](media-protection.md) (for future private media delivery)
