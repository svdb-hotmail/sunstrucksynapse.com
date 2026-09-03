import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";

const storybookViteConfigPath = fileURLToPath(new URL("./vite.config.ts", import.meta.url));

const config: StorybookConfig = {
  stories: ["../app/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    builder: {
      name: "@storybook/builder-vite",
      options: {
        viteConfigPath: storybookViteConfigPath,
      },
    },
  },
  docs: {
    autodocs: "tag",
  },
};

export default config;
