import { useOutletContext } from "react-router";

import { CatalogueSection } from "~/components/CatalogueSection";
import { Intro } from "~/components/Intro";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/brand";
import { buildCatalogueSections, catalogueStateCopy } from "~/services/catalogue";
import type { CatalogueLoadResult } from "~/types/catalogue";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: SITE_NAME },
  {
    name: "description",
    content: SITE_DESCRIPTION,
  },
  { tagName: "link", rel: "canonical", href: SITE_URL },
  { property: "og:url", content: SITE_URL },
];

export default function Home() {
  const { selectedItemId, catalogue, selectItem, queueItem, playItem } =
    useOutletContext<PlayerOutletContext>();
  const catalogueSections = buildCatalogueSections(catalogue.items, catalogue.collections);

  return (
    <>
      <Intro />
      <div id="catalogue" className="catalogue-anchor">
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
      </div>
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
