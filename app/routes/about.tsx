import { Link } from "react-router";

import { Contact } from "~/components/Contact";
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
        <h1>About SunSyn Radio</h1>
      </header>

      <Offerings offerings={offerings} />
      <section className="policy-links-panel" aria-labelledby="policy-links-heading">
        <div className="section-title">
          <h2 id="policy-links-heading">
            <span className="section-icon" aria-hidden="true">
              {"\u2600"}
            </span>
            Policy
          </h2>
        </div>
        <nav className="policy-links" aria-label="Policy pages">
          <Link to="/privacy">Privacy</Link>
          <Link to="/submission-terms">Submission terms</Link>
          <Link to="/takedown">Takedown</Link>
        </nav>
      </section>
      <Contact />
    </article>
  );
}
