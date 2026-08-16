import type { Offering } from "~/types/catalogue";

interface OfferingsProps {
  offerings: Offering[];
}

export function Offerings({ offerings }: OfferingsProps) {
  return (
    <section id="about" className="offerings">
      <div className="section-title">
        <h2>
          <span className="section-icon" aria-hidden="true">
            {"\u2600"}
          </span>
          About the radio
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
