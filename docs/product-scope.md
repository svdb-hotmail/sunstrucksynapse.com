# Sunstruck Synapse Radio product scope

## Product statement

Sunstruck Synapse Radio is a human-curated listening destination for intentional AI-assisted music:

> Exceptional music made with AI in the process, selected by humans.

The product leads with musical quality. AI is part of the disclosed creative process, while people remain accountable for making, submitting, evaluating, and publishing the work. The aim is a focused listening catalogue, not catalogue scale comparable to a general-purpose streaming service.

## Target audiences

The initial audiences are:

- **Listeners** looking for carefully selected AI-assisted music.
- **Artists** using AI as part of an intentional creative process.
- **Curators** reviewing musical quality, rights information, and creative-process disclosures before publication.

The MVP is curator-led and invitation-oriented. Artists may provide structured submissions when invited, but submission does not guarantee publication. Curators make the final editorial decision.

## Terminology

- **AI-assisted music:** Music for which AI tools or systems form a disclosed part of the creative or production process. Assistance may occur in composition, performance, sound design, arrangement, production, or another stage. The term does not describe one fixed production method and is not a genre.
- **Curated:** Deliberately reviewed and selected for publication by a human curator applying editorial judgment. It does not mean automated ranking, algorithmic acceptance, or unrestricted uploading.
- **Artist:** The credited person or group responsible for the intentional creative work represented on the platform, regardless of which disclosed tools were used.
- **Release:** A published grouping of one or more tracks presented as a coherent work, with shared credits, artwork, dates, and contextual information where applicable.
- **Track:** An individual audio work that can be played and described independently, whether published alone or within a release.
- **Editorial collection:** A named selection of published tracks or releases assembled by a human curator around a considered theme, context, or listening path.
- **Submission:** A structured proposal from an invited artist for curator review. It includes the music and required contextual, rights, and creative-process information; it is not publication itself.
- **Provenance:** Structured, traceable information about a work's origins and development, including relevant contributors, tools, source context, and process records. Provenance supports informed review and trust without presuming a particular technical system.
- **Creative-process disclosure:** An artist-provided account of how the work was made, including where AI was used and where meaningful human direction or decisions occurred.
- **Rights declaration:** The submitter's structured attestation that they have the authority and permissions needed for review and publication, including relevant ownership, licences, third-party material, and restrictions. A declaration supports review but is not a substitute for legal verification where that is required.

These terms describe product and editorial concepts. They do not select a technical architecture or prescribe one production workflow.

## Intended MVP capabilities

The following capabilities define the intended MVP. They are product targets, not claims that the implemented application foundation already provides them:

- A curated music catalogue.
- Real continuous audio playback.
- Queue and playback controls.
- Artist, release, and track pages.
- Editorial collections.
- Search and filtering.
- Curator administration.
- Structured artist submissions.
- Rights declarations and creative-process disclosures.
- Basic, privacy-conscious listener analytics.
- A responsive and accessible web experience.

The catalogue remains curator-controlled throughout the MVP. Artists provide material and declarations through an invitation-oriented submission process; curators decide what is published.

## Explicit MVP non-goals

The MVP does not include:

- Open self-publishing.
- Royalty accounting.
- Advertising.
- Native mobile applications.
- Algorithmic recommendation feeds.
- Social comments or messaging.
- Automated AI-quality scoring.
- Digital rights management (DRM).
- Payments.
- A public video catalogue.

These exclusions keep the first release focused on catalogue quality, real playback, and evidence of repeat listening. They are boundaries for the MVP, not promises that every excluded capability will or will not be built later.

## Sunstruck Synapse Radio and LEMM

Sunstruck Synapse Radio is the public listening, editorial, and curation product.

LEMM is a broader, creator-first generative-music initiative concerned with trusted infrastructure, provenance, governance, and creator interests. It is a separate initiative, not an alternate name for Sunstruck Synapse Radio.

The Sunstruck Synapse Radio MVP may express compatible principles, especially transparent provenance and enforceable trust. It must not technically depend on future LEMM infrastructure. This repository does not currently implement LEMM functionality, and product documentation must not imply otherwise.

## Initial success metrics

Initial measurement should answer four product questions:

| Question                                      | Initial measurements                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Will visitors start listening?                | Visitor-to-play conversion.                                            |
| Will listeners engage with the selected work? | Successful playback starts, 30-second listens, completions, and skips. |
| Will listeners return?                        | Seven-day returning-listener rate.                                     |
| Does editorial curation help discovery?       | Sustained listens originating from editorial collections.              |

Measurement should be basic and privacy-conscious, collecting only what is needed to answer these questions. Raw play count alone is not the primary success measure: meaningful listening, return behaviour, and editorially assisted discovery matter more.

## Product principles

- **Music quality before catalogue volume.** A smaller strong catalogue is preferable to indiscriminate scale.
- **Human editorial accountability.** People make and own publication decisions.
- **Transparent creative-process context.** Listeners and curators should be able to understand how AI contributed to a work.
- **Structured rights and provenance.** Rights declarations and provenance are product data, not informal marketing copy.
- **Privacy-conscious analytics.** Measure product usefulness without unnecessary listener tracking.
- **Honest representation.** Describe current capabilities accurately and label intended capabilities as future scope.
- **Trust through product design.** Enforce trust through review, structured data, and product controls rather than marketing promises.

## Current state and future possibilities

The repository now provides a React Router 8 framework-mode application with strict TypeScript, a componentized responsive application and player shell, typed temporary catalogue fixtures, and a Cloudflare Worker and Vite foundation. It does not yet provide the persistent curated catalogue, real continuous playback and queue, artist/release/track routes, editorial collections, search, curator administration, structured submissions and declarations, listener analytics, or production deployment required for the MVP described above.

Future phases may consider deeper creator workflows, richer provenance integrations, additional presentation formats, or selected capabilities currently outside the MVP. Such possibilities require separate product and technical decisions. They do not broaden this MVP, create a dependency on LEMM, or imply that future functionality already exists.
