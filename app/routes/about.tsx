import { Link } from "react-router";

import { ContactDialog } from "~/components/ContactDialog";
import { Offerings } from "~/components/Offerings";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/brand";
import { offerings } from "~/data/site";

import type { Route } from "./+types/about";

const ABOUT_URL = new URL("/about", SITE_URL).href;

export const meta: Route.MetaFunction = () => [
  { title: `About | ${SITE_NAME}` },
  {
    name: "description",
    content: SITE_DESCRIPTION,
  },
  { tagName: "link", rel: "canonical", href: ABOUT_URL },
  { property: "og:url", content: ABOUT_URL },
];

export default function AboutRoute() {
  return (
    <article className="about-page">
      <header className="about-hero">
        <p className="eyebrow">About</p>
        <h1>Music chosen by people, made with intent.</h1>
        <p className="about-summary">
          SunSyn Radio is a human-curated place for music and visual work made with clear creative
          direction—including work made with AI-assisted tools.
        </p>
      </header>

      <Offerings offerings={offerings} />
      <section className="policy-faq" aria-labelledby="policy-faq-heading">
        <div className="section-title">
          <h2 id="policy-faq-heading">
            <span className="section-icon" aria-hidden="true">
              {"\u2600"}
            </span>
            Policy questions
          </h2>
        </div>
        <p className="policy-faq-intro">Plain answers first. Full policies remain available.</p>
        <div className="policy-accordion">
          <details>
            <summary>How is personal information handled?</summary>
            <div>
              <p>
                We limit collection to information needed to run the radio, review submissions, and
                respond to messages.
              </p>
              <Link to="/privacy">Read the privacy notice</Link>
            </div>
          </details>
          <details>
            <summary>What should I know before submitting work?</summary>
            <div>
              <p>
                Submitters must control the relevant rights, disclose collaborators and generated
                material, and understand that review does not guarantee publication.
              </p>
              <Link to="/submission-terms">Read the submission terms</Link>
            </div>
          </details>
          <details>
            <summary>How do I report a rights concern?</summary>
            <div>
              <p>
                Send the work, the right involved, and a reliable way to reach you so the concern
                can be reviewed promptly.
              </p>
              <Link to="/takedown">Read the takedown process</Link>
            </div>
          </details>
        </div>
      </section>
      <ContactDialog />
    </article>
  );
}
