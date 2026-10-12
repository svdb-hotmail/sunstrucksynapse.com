# Production curator review fixes

The maintainer's solo exception remains active. This is implementation and focused verification, not independent Village approval. PRs stay Draft.

The real curator route now searches title, artist and reference across the repository before pagination. Queue filters and counts use database predicates; readiness and exclusive claims share the same immutable declaration eligibility. Draft rows remain visible, completed rows cannot appear Ready, and clarification requests appear Flagged. Pagination retains search and filters.

A saved final decision or clarification remains a successful response if claiming the next item fails. The workspace shows a recoverable warning instead of inviting a duplicate decision. Notification delivery failures and pending delivery remain visible. Browser review drafts restore after hydration. Protected evidence controls remain available.

The clarification modal uses the native dialog focus boundary, Escape and focus restoration. Background scoring shortcuts are suspended while it is open, and ordinary Ctrl/Cmd shortcuts cannot change a grade. Context/filter buttons use labelled groups and pressed state. The existing theme toggle, brand configuration and mono token are used. The historical prototype stack is explicitly superseded by L1–L3.

Focused validation: strict TypeScript, touched-file ESLint, production build and diff whitespace pass. Existing seven workflow cases and six curator route cases pass; added tests verify full-queue search/filter eligibility across pagination and saved-decision success despite next-claim failure. E2E selectors were updated for the real queue and review. The later MVP follow-up below supersedes the earlier browser limitation. Broad Draft-gated CI remains outstanding.

No production database, R2 media, access policy, secret or deployment was changed.

## MVP perspective follow-up

The artist sees explicit received/review/clarification/accepted/declined/withdrawn status and curator questions. Invitation responses omit internal curator activity, grading rationale and actor metadata. The final submit command uses its own form: validation on hidden editable fields can no longer silently block sending the saved draft. Backend audio, declarations and review gates remain intact. Private upload metadata uses a bounded shared reader and updates in place. Curators can inspect selected submissions and the stored private rights context; draft rows no longer show an invalid elapsed date. Score/grade inputs remain real, keyboard-operable controls.

Actual Chromium verification now passes invitation creation, private review claim, scoring, native clarification dialog focus/Escape/restoration, retained rationale through reload, finalization/next and the artist draft/no-audio/privacy journey. Broad CI remains maintainer Ready-gated. These local browser checks use the explicit test identity and fixtures, not production Access.

Receipt and clarification notifications now run under Worker waitUntil after the durable submission/question succeeds. A missing or failed email provider cannot turn a saved question into a failed action; the curator sees a delivery warning and the artist can read it through their private link. Postmark requests have a ten-second timeout. Focused service/workspace checks pass (10 cases), including saved clarification on delivery failure; strict TypeScript passes.

The maintainer clarified that the currently live catalogue is test content. It was preserved; this does not constitute a real first album launch.
