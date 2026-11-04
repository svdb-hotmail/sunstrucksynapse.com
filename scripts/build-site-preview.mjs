import { cp, mkdir, writeFile, rm, access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import console from "node:console";

const output = resolve("storybook-static");
// Preserve the component catalogue at /storybook/; the root becomes the real site.
await access(resolve(output, "index.html"));
const savedStorybook = await mkdtemp(resolve(tmpdir(), "sunsyn-storybook-"));
await cp(output, savedStorybook, { recursive: true });
const redirectPath = resolve(".wrangler/deploy/config.json");
let previousRedirect = await readFile(redirectPath, "utf8").catch((error) => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
if (previousRedirect?.includes("build/site-preview/")) previousRedirect = null;
try {
  const result = spawnSync(
    "npm",
    ["exec", "--", "react-router", "build", "--mode", "site-preview"],
    {
      stdio: "inherit",
      env: { ...process.env, SUNSYN_SITE_PREVIEW_BUILD: "1" },
    },
  );
  if (result.status !== 0) throw new Error(`Preview build failed (${result.status ?? "signal"}).`);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(savedStorybook, resolve(output, "storybook"), { recursive: true });
  await cp(resolve("build/site-preview/client"), output, { recursive: true });
  await mkdir(resolve(output, "_worker.js/server"), { recursive: true });
  await cp(
    resolve("build/site-preview/server/index.js"),
    resolve(output, "_worker.js/server/index.js"),
  );
  await cp(
    resolve("build/site-preview/server/assets"),
    resolve(output, "_worker.js/server/assets"),
    {
      recursive: true,
    },
  );
  await writeFile(
    resolve(output, "_worker.js/index.js"),
    `import site from './server/index.js';
export default { fetch(request, env, ctx) {
  const path = new URL(request.url).pathname;
  if (path === '/storybook') return Response.redirect(new URL('/storybook/', request.url), 302);
  if (/^\\/curator\\/prepared-audio\\/sample-[0-2]$/.test(path)) {
    const sample = new URL('/assets/audio/Sunstruck%20Synapse%20(Revolution%20will%20be%20televised).mp3', request.url);
    return env.ASSETS.fetch(new Request(sample, request));
  }
  if (path.startsWith('/storybook/') || path.startsWith('/assets/')) return env.ASSETS.fetch(request);
  return site.fetch(request, env, ctx);
}};
`,
  );
  await writeFile(
    resolve(output, "_routes.json"),
    JSON.stringify(
      { version: 1, include: ["/*"], exclude: ["/assets/*", "/storybook/*"] },
      null,
      2,
    ) + "\n",
  );
  await writeFile(resolve(output, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
  console.log(
    "Full-site preview packaged at storybook-static/; component catalogue at /storybook/.",
  );
} finally {
  if (previousRedirect === null) await rm(redirectPath, { force: true });
  else await writeFile(redirectPath, previousRedirect);
  await rm(savedStorybook, { recursive: true, force: true });
}
