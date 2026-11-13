import { SITE_NAME } from "~/config/brand";

export function Intro() {
  return (
    <section id="top" className="intro-strip">
      <div>
        <p className="eyebrow">Human-curated {"\u2022"} AI-assisted music</p>
        <h2>Music Made With Intent</h2>
      </div>
      <p>
        {SITE_NAME} is a human-curated listening space for thoughtful music made with AI in the
        process. Discover work shaped by human taste, direction, and authorship.
      </p>
    </section>
  );
}
