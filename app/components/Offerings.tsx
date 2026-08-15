import type { Offering } from "~/types/catalogue";

interface OfferingsProps {
  offerings: Offering[];
}

export function Offerings({ offerings }: OfferingsProps) {
  return (
    <section id="offerings" className="offerings">
      <div className="section-title">
        <h2>
          <span className="section-icon">{"\u2600"}</span>Offerings
        </h2>
      </div>

      <div className="offer-grid">
        {offerings.map((offering) => (
          <article key={offering.id}>
            <span>{offering.number}</span>
            <h3>{offering.title}</h3>
            <p>{offering.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
