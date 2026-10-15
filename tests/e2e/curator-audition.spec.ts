import { test, expect } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import path from "node:path";

// Focused browser smoke for the actual component's native media events. Only
// generated silence is served; no artist recordings or production services.
let server: ViteDevServer;
let origin: string;
const moduleId = path.resolve("__curator-audition-smoke.jsx");
const harness = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {PublishingWorkspace} from '/app/features/curator-workspace/PublishingWorkspace.tsx';
const base={genre:'Ambient',genres:['Ambient'],moods:['Calm'],processTags:['Mixing'],coverId:null,failureCode:null};
function Harness(){
 const [tracks,setTracks]=useState([
 {...base,id:'track-a',title:'Track A',position:1,preparationStatus:'processing'},
 {...base,id:'track-b',title:'Track B',position:2,preparationStatus:'ready'}]);
 return <MemoryRouter>
 <button onClick={()=>setTracks(ts=>ts.map(t=>({...t,preparationStatus:'ready'})))}>Finish preparation</button>
 <button onClick={()=>setTracks(ts=>[...ts].reverse())}>Reverse order</button>
 <PublishingWorkspace title="Synthetic release" artistName="Synthetic artist" releaseKind="album"
 tracks={tracks} readiness={[]} encodingAvailable onPublish={()=>{}} onRetry={()=>{}} onRefresh={()=>{}}/>
 </MemoryRouter>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
`;
function silentWav() {
  const bytes = Buffer.alloc(44 + 8000 * 10 * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(bytes.length - 44, 40);
  return bytes;
}
test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    optimizeDeps: {
      noDiscovery: true,
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "react-router",
      ],
      holdUntilCrawlEnd: false,
    },
    root: process.cwd(),
    resolve: { alias: { "~": path.resolve("app") } },
    server: { host: "127.0.0.1", port: 0 },
    plugins: [
      {
        name: "curator-audition-smoke",
        resolveId(id) {
          if (id === "/__curator-audition-smoke.jsx") return moduleId;
        },
        load(id) {
          if (id === moduleId) return harness;
        },
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            if (req.url !== "/") return next();
            res.setHeader("content-type", "text/html");
            res.end(
              '<div id="root"></div><script type="module" src="/__curator-audition-smoke.jsx"></script>',
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("Missing smoke server address");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await server?.close();
});
for (const control of ["native", "audition"] as const) {
  test(`keeps ${control} playback on the selected track across preparation and order refreshes`, async ({
    page,
  }) => {
    await page.route("**/curator/prepared-audio/*", (route) =>
      route.fulfill({ status: 200, contentType: "audio/wav", body: silentWav() }),
    );
    await page.goto(origin);
    // Native audio has an aria-label but no implicit ARIA role.
    const player = page.locator('audio[aria-label="Private streaming preview"]');
    await expect(player).toHaveAttribute("src", "/curator/prepared-audio/track-b");
    if (control === "native") await player.evaluate((el: HTMLAudioElement) => el.play());
    else await page.getByRole("button", { name: "Audition Track B", exact: true }).click();
    await expect.poll(() => player.evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
    await page.getByRole("button", { name: "Finish preparation", exact: true }).click();
    await expect(player).toHaveAttribute("src", "/curator/prepared-audio/track-b");
    await page.getByRole("button", { name: "Reverse order", exact: true }).click();
    await expect(player).toHaveAttribute("src", "/curator/prepared-audio/track-b");
    await expect.poll(() => player.evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
  });
}
test("retries an errored selected track after private delivery recovers", async ({ page }) => {
  let failing = true;
  await page.route("**/curator/prepared-audio/*", (route) =>
    failing
      ? route.fulfill({ status: 503, body: "Synthetic temporary failure" })
      : route.fulfill({ status: 200, contentType: "audio/wav", body: silentWav() }),
  );
  await page.goto(origin);
  const player = page.locator('audio[aria-label="Private streaming preview"]');
  await expect.poll(() => player.evaluate((el: HTMLAudioElement) => Boolean(el.error))).toBe(true);
  failing = false;
  await page.getByRole("button", { name: "Audition Track B", exact: true }).click();
  await expect.poll(() => player.evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
  await expect.poll(() => player.evaluate((el: HTMLAudioElement) => el.error)).toBeNull();
});
