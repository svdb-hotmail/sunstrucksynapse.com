# Radio first listener experience

The maintainer selected the Radio first direction on 17 October 2026 (Europe/Brussels).
This increment puts a usable listening choice and the requested destination ahead of
large featured artwork. It uses the existing published catalogue and media coordinator.

## Listener behaviour

- Listen, Explore and Queue are stable destinations/tools, including with a small or
  empty catalogue. About and privacy remain available from the footer.
- The home selection uses the published Listen collection in its editorial order.
  Without a playable Listen collection, it uses all published audio in catalogue
  order. Other collections remain explicit listening paths. It never invents an editorial collection or includes unavailable
  media in the selection. Track counts and known durations come from catalogue data.
- The short homepage list starts with that selection and includes at most six unique
  tracks. At most four releases and four collection links follow; release presentation
  retains its own cover and artist credits. Further browsing goes through Explore.
- A fresh visit has no unrelated selected track or player above the page. A restored
  session shows a paused mini player. Starting or changing music preserves browsing
  scroll and focus; artwork and title links only navigate.
- The mini player expands to a full player with seeking, previous/next, sharing and a
  link to the actual track's details/credits. The same native media element stays
  mounted while panels open/close and public routes change. Loading and retry messages
  remain visible even when the full player is closed.
- Queue additions show their position, duplicates receive an explicit message, and
  Play next moves an existing queued track rather than duplicating it. Remove, clear
  and move up/down offer a single Undo. Starting/advancing a track invalidates that
  queue snapshot so Undo cannot resurrect consumed entries.
- The edited queue is authoritative for what plays next. Play next, reordering and
  choosing a later queued track update the finite scope as well as its Undo snapshot;
  consumed tracks cannot return through catalogue adjacency. Deliberately requeuing
  a played track allows one further play. Outside insertions retain the finite boundary.
- Album and selection context (including collection attribution) survives Previous,
  interruption by an individual track and paused reloads, including at the end of an
  empty queue. Cross-release selections retain their own grouping rather than acquiring
  album identity. Older stored album queues remain readable.
- Play selection and Play collection use an explicit finite playback scope and replace
  the current queue, as stated beside the action. Album playback retains its ordered
  scope. Existing unscoped individual-track continuation is preserved.
- Static audio resumes the existing element and position from cards, track pages,
  the dock and Media Session controls. Signed media retains URL refresh on resume.
- Explore keeps the search field and results near the top. Optional filters are a
  disclosure, with an applied count; empty groups disappear. Unknown URL selections
  remain visible and clearable. Search and filters remain URL-backed.

## Boundaries and validation

There are no database/schema, publication, authentication or media-policy changes.
Accounts, favourites, listening history, position resume and artwork derivative
creation are separate increments. Lazy artwork and bounded shelves reduce eager
rendering; they do not compress existing large artwork assets.

Use the standard format, lint, type, unit, build, Storybook and Playwright commands.
Focused listener tests cover 320/360/390px phones, direct track links, actual playback,
route continuity, shared links, queue undo/reordering, retained focus, real media
endings, finite selection/album order and paused restoration. Existing curator,
submission, publication and protected-metadata tests remain in the full browser suite.

`serveSeekableMedia` supplies byte-range responses for local fixture files, because
Vite's local asset preview otherwise returns 200 to a range request. It does not mock
media playback, timers or ended events. Production keeps its existing media delivery.
In the managed cloud sandbox, WebKit also needs its media cache under `/var/tmp` and
Firefox needs native process-sandbox access; use the verified browser permissions
rather than weakening playback assertions. Real phone OS/background playback remains
an additional device acceptance check.

Work follows the continuing maintainer-authorized solo exception. The implementation
review and browser checks are self-review evidence, not independent Village acceptance.
