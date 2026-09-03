import type { Meta, StoryObj } from "@storybook/react-vite";

import { ThemeToggle } from "~/design-system/ThemeToggle";

const meta = {
  title: "Design System/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The production theme control. The Storybook preview supplies a theme toolbar and does not write a theme preference to localStorage.",
      },
    },
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkMode: Story = {
  globals: { theme: "dark" },
};

export const LightMode: Story = {
  globals: { theme: "light" },
};
