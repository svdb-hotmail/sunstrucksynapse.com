import { Link } from "react-router";

export default function SubmissionTermsRoute() {
  return (
    <article className="entity-page legal-page">
      <p className="eyebrow">Policy</p>
      <h1>Submission terms</h1>
      <p>Last updated: 19 August 2026.</p>
      <p>
        By submitting, you confirm that your declarations are accurate, that you control or have
        documented permission for every relevant right, and that you may authorize review and the
        proposed publication. Disclose samples, licensed material, generated material, voice
        cloning, collaborators, restrictions, and territorial limits.
      </p>
      <p>
        Submission does not guarantee acceptance or publication. Curators may request clarification,
        reject a submission, pause publication, or archive accepted material when a rights, safety,
        quality, or policy concern arises. Acceptance does not transfer ownership; any separate
        distribution or licensing agreement must be explicit.
      </p>
      <p>
        Do not upload unnecessary identity documents, credentials, malicious files, unlawful
        material, or evidence unrelated to the rights review. Private evidence is access-controlled
        and handled under the privacy notice, but no internet service can promise absolute security.
      </p>
      <p>
        To correct or withdraw a submission, contact{" "}
        <a href="mailto:hello@sunstrucksynapse.com">hello@sunstrucksynapse.com</a> and include the
        stable submission reference.
      </p>
      <p>
        <Link to="/privacy">Read the privacy notice</Link>
        {" · "}
        <Link to="/takedown">Read the takedown process</Link>
      </p>
    </article>
  );
}
