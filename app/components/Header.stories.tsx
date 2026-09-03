import type { Meta, StoryObj } from "@storybook/react-vite";

import { Header } from "~/components/Header";

const meta = {
  title: "Production/Header",
  component: Header,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The production radio header, rendered inside the shared MemoryRouter decorator so every navigation link remains inspectable.",
      },
    },
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LightTheme: Story = {
  globals: { theme: "light" },
};
