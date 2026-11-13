import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  buildDirectory: process.env.SUNSYN_BUILD_DIR ?? "build",
} satisfies Config;
