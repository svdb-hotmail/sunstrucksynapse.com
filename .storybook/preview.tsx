import type { ElementType } from "react";
import { MemoryRouter } from "react-router";
import type { Decorator, Preview } from "@storybook/react-vite";

import "~/styles/global.css";

type Theme = "light" | "dark";

interface ThemeFrameProps {
  theme: Theme;
  Story: ElementType;
}

function ThemeFrame({ theme, Story }: ThemeFrameProps) {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <div data-theme={theme} className={`storybook-theme storybook-theme--${theme}`}>
        <Story />
      </div>
    </MemoryRouter>
  );
}

const withThemeAndRouter: Decorator = (Story, context) => {
  const theme: Theme = context.globals.theme === "light" ? "light" : "dark";
  return <ThemeFrame theme={theme} Story={Story} />;
};

const preview: Preview = {
  decorators: [withThemeAndRouter],
  globalTypes: {
    theme: {
      description: "Global colour theme",
      defaultValue: "dark",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "dark", title: "Dark theme" },
          { value: "light", title: "Light theme" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    a11y: {
      test: "todo",
    },
    layout: "fullscreen",
  },
};

export default preview;
