import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("../app", import.meta.url)),
    },
  },
});
