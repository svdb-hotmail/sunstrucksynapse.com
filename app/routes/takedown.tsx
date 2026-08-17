import { Link } from "react-router";

export default function TakedownRoute() {
  return (
    <article className="entity-page legal-page">
      <p className="eyebrow">Policy</p>
      <h1>Content takedown process</h1>
      <p>
        Report copyright, performer-rights, privacy, impersonation, consent, or other content
        concerns to <a href="mailto:hello@sunstrucksynapse.com">hello@sunstrucksynapse.com</a>.
      </p>
      <h2>Include</h2>
      <ul>
        <li>Your name, role, and a reliable contact address.</li>
        <li>The exact track, release, artist, collection, or URL concerned.</li>
        <li>The right or policy involved and your relationship to it.</li>
        <li>Enough evidence to assess the request, without unrelated sensitive information.</li>
      </ul>
      <h2>What happens next</h2>
      <p>
        A curator records the report separately from public analytics, acknowledges it, reviews the
        accepted rights and provenance record, and may archive the content while investigating.
        Publication lifecycle changes remain in the curator audit trail. Relevant private evidence
        is restricted to authorized curators and may be preserved while a dispute remains active.
      </p>
      <p>
        We may ask for clarification or notify the submitter where lawful and appropriate. The
        outcome may be restoration, correction, restricted delivery, or continued removal. Urgent
        safety or privacy concerns should be identified clearly in the subject line.
      </p>
      <Link to="/">Back to the radio</Link>
    </article>
  );
}
