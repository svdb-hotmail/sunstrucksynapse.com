import { useOutletContext } from "react-router";

import { CatalogueSection } from "~/components/CatalogueSection";
import { Contact } from "~/components/Contact";
import { Intro } from "~/components/Intro";
import { Offerings } from "~/components/Offerings";
import { catalogueSections, offerings } from "~/data/catalogue";
import type { PlayerOutletContext } from "~/types/catalogue";

import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "Sunstruck Synapse | Audio + Video Portfolio" },
  {
    name: "description",
    content:
      "Sunstruck Synapse audio and video portfolio with a streaming-style media player, work collections, and offerings.",
  },
];

export default function Home() {
  const { selectedItemId, selectItem } = useOutletContext<PlayerOutletContext>();

  return (
    <>
      <Intro />
      {catalogueSections.map((section) => (
        <CatalogueSection
          section={section}
          selectedItemId={selectedItemId}
          onSelect={selectItem}
          key={section.id}
        />
      ))}
      <Offerings offerings={offerings} />
      <section className="protection-note">
        <h2>Media protection</h2>
        <p>
          Players hide download controls and block casual right-click saving. For stronger
          protection, use private object storage plus signed streaming URLs, HLS/DASH delivery, or
          DRM.
        </p>
      </section>
      <Contact />
    </>
  );
}
