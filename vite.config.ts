import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    cloudflare({
      ...(mode === "site-preview"
        ? { configPath: "wrangler.site-preview.jsonc" }
        : process.env.SUNSYN_WRANGLER_CONFIG
          ? { configPath: process.env.SUNSYN_WRANGLER_CONFIG }
          : {}),
      viteEnvironment: { name: "ssr" },
    }),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
}));
