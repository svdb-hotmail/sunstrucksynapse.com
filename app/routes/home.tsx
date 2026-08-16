import { useOutletContext } from "react-router";

import { CatalogueSection } from "~/components/CatalogueSection";
import { Contact } from "~/components/Contact";
import { Intro } from "~/components/Intro";
import { Offerings } from "~/components/Offerings";
import { offerings } from "~/data/site";
import { buildCatalogueSections, catalogueStateCopy } from "~/services/catalogue";
import type { CatalogueLoadResult } from "~/types/catalogue";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "Sunstruck Synapse Radio" },
  {
    name: "description",
    content:
      "Sunstruck Synapse Radio is a human-curated listening destination for intentional AI-assisted music.",
  },
];

export default function Home() {
  const { selectedItemId, catalogue, selectItem, queueItem, playItem } =
    useOutletContext<PlayerOutletContext>();
  const catalogueSections = buildCatalogueSections(catalogue.items);

  return (
    <>
      <Intro />
      {catalogue.status === "ready" ? (
        catalogueSections.map((section) => (
          <CatalogueSection
            section={section}
            selectedItemId={selectedItemId}
            onSelect={selectItem}
            onQueue={queueItem}
            onPlay={playItem}
            key={section.id}
          />
        ))
      ) : (
        <CatalogueState state={catalogue} />
      )}
      <Offerings offerings={offerings} />
      <Contact />
    </>
  );
}

export function CatalogueState({ state }: { state: CatalogueLoadResult }) {
  if (state.status === "ready") {
    return null;
  }
  const copy = catalogueStateCopy(state);

  return (
    <section className="catalogue-state" aria-live="polite">
      <p className="eyebrow">Catalogue</p>
      <h2>{copy.heading}</h2>
      <p>{copy.message}</p>
    </section>
  );
}
