import { Link } from "react-router";

import { SITE_NAME } from "~/config/brand";

export const meta = () => [{ title: `Privacy | ${SITE_NAME}` }];

export default function PrivacyRoute() {
  return (
    <article className="entity-page legal-page privacy-page">
      <header className="privacy-page__header">
        <p className="eyebrow">SUNSYN / The details</p>
        <h1>Privacy notice</h1>
        <p className="privacy-page__intro">
          A clear account of the information used to run the radio and review submissions.
        </p>
        <p className="privacy-page__updated">
          Last updated <time dateTime="2026-08-19">19 August 2026</time>
        </p>
      </header>

      <div className="privacy-page__sections">
        <section>
          <h2>Public listening</h2>
          <p>
            We collect first-party catalogue and playback events to understand reliability and
            editorial use. Events contain a random browser-tab session identifier stored only as a
            SHA-256 hash, event time, event type, and relevant catalogue identifiers. We do not
            store listener names, email addresses, advertising identifiers, or IP addresses with
            these events. Raw events are deleted after 90 days.
          </p>
        </section>
        <section>
          <h2>Artist submissions</h2>
          <p>
            Invite-only submissions contain the contact, rights, provenance, creative-process, and
            private evidence information that the submitter provides. Curators use it only to review
            the proposed work, communicate about the review, maintain an audit trail, and respond to
            rights disputes. Private evidence is never published. It is retained until review and
            any related rights or audit obligations permit a curator to schedule deletion.
          </p>
        </section>
        <section>
          <h2>Curator access and contact</h2>
          <p>
            Cloudflare Access authenticates curator accounts. The application records curator email
            addresses in publication and evidence-access audits. The public contact form opens the
            visitor&apos;s email client; the site does not receive the message unless it is sent.
          </p>
        </section>
        <section>
          <h2>Requests</h2>
          <p>
            Ask for access, correction, deletion, or a retention explanation at{" "}
            <a href="mailto:hello@sunstrucksynapse.com">hello@sunstrucksynapse.com</a>. Some records
            may need to be preserved for rights, security, or audit obligations.
          </p>
        </section>
      </div>

      <footer className="privacy-page__footer">
        <Link to="/about">← Back to About</Link>
        <Link to="/">Return to SUNSYN →</Link>
      </footer>
    </article>
  );
}
