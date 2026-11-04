import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  buildDirectory: process.env.SUNSYN_SITE_PREVIEW_BUILD === "1" ? "build/site-preview" : "build",
} satisfies Config;
