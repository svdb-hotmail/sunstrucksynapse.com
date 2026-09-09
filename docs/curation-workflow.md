# Near-zero-touch curation workflow

The artist's job is to provide the requested input, not to model the curation database. The
invitation page therefore has three visible steps:

1. Enter the essential track details: artist, title, contact email, a short account of the creative
   process, AI tools, rights basis and territory, explicit sample/voice/third-party flags, and one
   combined confirmation. Save once to enable audio upload; later final submission includes any
   edits currently visible in the form.
2. Upload one private listening copy.
3. Submit once the listening copy is ready.

Release metadata is optional and supporting evidence stays collapsed unless a curator asks for it.
The application derives the structured rights, process, provenance, and acknowledgement records
from the compact intake while retaining the same server validation and curator eligibility checks.
Detailed rights context remains private to the curator workflow; public disclosure receives only a
derived category-level summary. Existing category-specific rights details are preserved when a
legacy draft is opened and saved without changing the combined rights field.
The browser hashes the audio without loading the entire file into application memory, then uploads
directly to a short-lived R2 staging URL. Replacing the file creates a new version; it never
overwrites audio a curator may already have heard. Once submitted, both new upload sessions and
in-flight finalization are rejected until a curator explicitly requests clarification.

The curator's normal path is intentionally three actions:

1. Select **Review next ready submission**. The database exclusively claims the oldest unassigned
   submission whose declarations and private audio pass the deterministic eligibility preflight.
2. Listen in the review card and score artistic quality, originality/intent, production readiness,
   and editorial fit from 1 to 5.
3. Choose A, B, or C, write a concise rationale, and finalize.

A means accepted with feature distinction, B means accepted, and C means declined. The four scores
inform but never calculate the grade. Eligibility is separate and unweighted. A/B creates draft
catalogue records and a decision-notification outbox entry in the same database statement. A never
publishes, schedules, or pins an item. Catalogue publication is separately blocked until review,
public media, primary artwork, metadata, and parent-release readiness are present.

Exceptions remain visible in the existing detailed declaration, clarification, evidence, and
activity controls below the scorecard. Legacy terminal submissions are displayed as historical
records and receive no fabricated grade.

## Storybook

Run `npm run storybook`, then open `http://localhost:6006`. The production stories are under
**Production / CurationScorecard** and **Production / ReviewAudioUploader**. Use the paintbrush
toolbar control to inspect the same components in light and dark themes.
