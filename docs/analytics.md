# Privacy-conscious catalogue analytics

Sunstruck Synapse Radio collects only first-party events needed to understand catalogue
discovery and playback. It does not use advertising identifiers, cookies, IP addresses,
email addresses, or Cloudflare Access identities for listener analytics.

## Event definitions

- `catalogue_impression`: a published catalogue result was shown.
- `collection_view`: a dedicated editorial collection page was viewed.
- `play_requested`: a listener explicitly asked the player to start a track.
- `playback_started`: the browser reported that playback started.
- `listen_30_seconds`: playback crossed 30 seconds for the current play.
- `completion`: playback reached the media end.
- `skip`: the listener changed tracks after playback started and before completion.
- `replay`: a completed track started again.
- `playback_error`: the browser reported a media loading or playback error.
- `share`: the listener used a first-party share control.
- `outbound_artist_click`: the listener followed an artist link away from the site.

Each event has a client-generated UUID for retry deduplication. A random identifier lives
only for the browser tab session and is stored solely as a one-way SHA-256 hash. User-agent
strings matching common bot, crawler, headless, or link-preview markers are flagged at
ingest and excluded from curator summaries.

## Retention and deletion

Raw events are retained for 90 days. The Worker scheduled handler removes older rows,
alongside scheduled publication work. Operators can perform the same cleanup manually:

```sql
delete from playback_events where received_at < now() - interval '90 days';
```

Deleting a catalogue entity removes no historical event row but clears its foreign-key
reference. Event ingestion is best-effort and never blocks playback.

## Limits

Events measure browser signals, not verified human attention. Network loss, privacy tools,
background playback, shared devices, and imperfect bot detection can undercount or
overcount activity. The dashboard is directional editorial evidence, not individual
listener tracking or royalty accounting.
