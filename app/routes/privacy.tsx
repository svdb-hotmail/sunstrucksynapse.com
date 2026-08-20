import { Link } from "react-router";

export default function PrivacyRoute() {
  return (
    <article className="entity-page legal-page">
      <p className="eyebrow">Policy</p>
      <h1>Privacy notice</h1>
      <p>Last updated: 19 August 2026.</p>
      <h2>Public listening</h2>
      <p>
        We collect first-party catalogue and playback events to understand reliability and editorial
        use. Events contain a random browser-tab session identifier stored only as a SHA-256 hash,
        event time, event type, and relevant catalogue identifiers. We do not store listener names,
        email addresses, advertising identifiers, or IP addresses with these events. Raw events are
        deleted after 90 days.
      </p>
      <h2>Artist submissions</h2>
      <p>
        Invite-only submissions contain the contact, rights, provenance, creative-process, and
        private evidence information that the submitter provides. Curators use it only to review the
        proposed work, communicate about the review, maintain an audit trail, and respond to rights
        disputes. Private evidence is never published. It is retained until review and any related
        rights or audit obligations permit a curator to schedule deletion.
      </p>
      <h2>Curator access and contact</h2>
      <p>
        Cloudflare Access authenticates curator accounts. The application records curator email
        addresses in publication and evidence-access audits. The public contact form opens the
        visitor&apos;s email client; the site does not receive the message unless it is sent.
      </p>
      <h2>Requests</h2>
      <p>
        Ask for access, correction, deletion, or a retention explanation at{" "}
        <a href="mailto:hello@sunstrucksynapse.com">hello@sunstrucksynapse.com</a>. Some records may
        need to be preserved for rights, security, or audit obligations.
      </p>
      <Link to="/">Back to the radio</Link>
    </article>
  );
}
