import { SITE_NAME } from "~/config/brand";

export function Intro() {
  return (
    <section id="top" className="intro-strip">
      <div>
        <p className="eyebrow">Human-curated {"\u2022"} AI-assisted music</p>
        <h2>A radio for music made with intent.</h2>
      </div>
      <p>
        {SITE_NAME} is a human-curated radio for intentional AI-assisted music and its visual
        counterparts. AI is part of the instrument. Human taste, direction and authorship remain at
        the centre.
      </p>
    </section>
  );
}
