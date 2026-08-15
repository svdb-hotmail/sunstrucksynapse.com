import { useOutletContext } from "react-router";

import { CatalogueSection } from "~/components/CatalogueSection";
import { Contact } from "~/components/Contact";
import { Intro } from "~/components/Intro";
import { Offerings } from "~/components/Offerings";
import { catalogueSections, offerings } from "~/data/catalogue";
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
  const { selectedItemId, selectItem, queueItem, playItem } =
    useOutletContext<PlayerOutletContext>();

  return (
    <>
      <Intro />
      {catalogueSections.map((section) => (
        <CatalogueSection
          section={section}
          selectedItemId={selectedItemId}
          onSelect={selectItem}
          onQueue={queueItem}
          onPlay={playItem}
          key={section.id}
        />
      ))}
      <Offerings offerings={offerings} />
      <Contact />
    </>
  );
}
