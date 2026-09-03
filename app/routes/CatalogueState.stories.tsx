import type { Meta, StoryObj } from "@storybook/react-vite";

import { CatalogueState } from "~/routes/home";
import type { CatalogueLoadResult } from "~/types/catalogue";

const errorState: Extract<CatalogueLoadResult, { status: "error" }> = {
  status: "error",
  items: [],
  collections: [],
  message: "The catalogue is temporarily unavailable. Please try again shortly.",
};

const emptyState: Extract<CatalogueLoadResult, { status: "empty" }> = {
  status: "empty",
  items: [],
  collections: [],
};

const meta = {
  title: "Production/CatalogueState",
  component: CatalogueState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The production catalogue fallback for empty and unavailable/error results. It is imported from the public home route without loading server or Worker dependencies.",
      },
    },
  },
} satisfies Meta<typeof CatalogueState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unavailable: Story = {
  args: { state: errorState },
};

export const Empty: Story = {
  args: { state: emptyState },
};

export const LightTheme: Story = {
  args: { state: errorState },
  globals: { theme: "light" },
};
