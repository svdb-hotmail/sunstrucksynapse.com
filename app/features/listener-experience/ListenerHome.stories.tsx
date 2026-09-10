import type { Meta, StoryObj } from "@storybook/react-vite";

import { CatalogueSection } from "~/components/CatalogueSection";
import { Intro } from "~/components/Intro";
import { buildCatalogueNavigation } from "~/services/catalogue";

import { listenerGenres, listenerItems, listenerSections } from "./fixtures";
import { GenreRail } from "./ListenerGenres";
import { ListenerProductPrototype } from "./ListenerProductPrototype";

function ListenerHomePrototype() {
  return (
    <ListenerProductPrototype
      navigation={[
        ...buildCatalogueNavigation(listenerSections).slice(0, 2),
        { label: "Genres", to: "/#genres" },
        ...buildCatalogueNavigation(listenerSections).slice(2),
      ]}
    >
      {({ selectedItemId, onPlay, onQueue, onSelect }) => (
        <>
          <Intro />
          <GenreRail genres={listenerGenres} items={listenerItems} />
          <div id="catalogue" className="catalogue-anchor">
            {listenerSections.map((section) => (
              <CatalogueSection
                key={section.id}
                section={section}
                selectedItemId={selectedItemId}
                onSelect={onSelect}
                onQueue={(item) => onQueue(item, section.id)}
                onPlay={onPlay}
              />
            ))}
          </div>
        </>
      )}
    </ListenerProductPrototype>
  );
}

const meta = {
  title: "Listener Experience/Home/Interactive product preview",
  component: ListenerHomePrototype,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The complete listener-facing home experience, composed from the same production header, player, catalogue, navigation, theme control, and design tokens shipped by the application.",
      },
    },
  },
} satisfies Meta<typeof ListenerHomePrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = { globals: { theme: "dark" } };
export const LightTheme: Story = { globals: { theme: "light" } };
