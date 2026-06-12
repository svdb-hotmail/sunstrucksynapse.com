# Media Protection Notes

## Important limitation

Browser-level controls can hide download buttons, disable right-click menus, or obscure direct URLs, but they **cannot** make publicly delivered media impossible to extract. If media can be played in a public browser session, a determined user can still capture it.

## Stronger protection options

For stronger protection than basic front-end controls, consider:

- Private media hosting (authenticated access)
- Signed URLs with expiry and scope restrictions
- Adaptive streaming (HLS/DASH)
- DRM-based playback controls

## Google Cloud options to evaluate

Possible stronger options include:

- **Google Cloud Storage** for controlled/private object storage
- **Google Transcoder API** to prepare streaming renditions
- **Media CDN signed URLs** for time-limited, controlled distribution
- **Widevine DRM** for stronger content protection workflows

These options improve control but also increase complexity and cost. Choose based on your threat model and business needs.
