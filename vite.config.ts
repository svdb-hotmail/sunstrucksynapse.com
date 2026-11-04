import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    cloudflare({
      ...(mode === "site-preview" ? { configPath: "wrangler.site-preview.jsonc" } : {}),
      viteEnvironment: { name: "ssr" },
    }),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
}));
