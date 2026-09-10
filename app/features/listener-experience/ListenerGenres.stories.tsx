import type { Meta, StoryObj } from "@storybook/react-vite";

import type { CatalogueNavigationEntry } from "~/services/catalogue";

import { listenerGenres, listenerItems } from "./fixtures";
import { GenreCatalogue } from "./ListenerGenres";
import { ListenerProductPrototype } from "./ListenerProductPrototype";

const genreNavigation: CatalogueNavigationEntry[] = [
  { label: "Latest", to: "/#latest" },
  { label: "Listen", to: "/#audio" },
  { label: "Genres", to: "/genres" },
  { label: "Search", to: "/search" },
  { label: "About", to: "/about" },
];

function ListenerGenresPrototype() {
  return (
    <ListenerProductPrototype navigation={genreNavigation}>
      {(context) => <GenreCatalogue {...context} genres={listenerGenres} items={listenerItems} />}
    </ListenerProductPrototype>
  );
}

const meta = {
  title: "Listener Experience/Genres/Interactive catalogue",
  component: ListenerGenresPrototype,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The genre directory and selected-genre catalogue reuse the production listener shell, player, account, weekly feedback, and catalogue components.",
      },
    },
  },
} satisfies Meta<typeof ListenerGenresPrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = { globals: { theme: "dark" } };
export const LightTheme: Story = { globals: { theme: "light" } };
