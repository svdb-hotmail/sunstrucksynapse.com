import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: "../public",
  esbuild: { jsx: "automatic" },
  server: { host: "0.0.0.0", port: 5174, strictPort: true },
  build: { outDir: "../build/design-mockup", emptyOutDir: true },
});
