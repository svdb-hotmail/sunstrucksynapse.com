import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import path from "node:path";

let server: ViteDevServer;
let origin: string;
const moduleId = path.resolve("__submission-editor-smoke.jsx");
const harness = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {SubmissionEditor} from '/app/features/curator-workspace/SubmissionEditor.tsx';
import '/app/styles/global.css';
const params=new URLSearchParams(location.search);
const data={id:'synthetic',reference:'SUB-SYNTHETIC',status:'accepted',artistName:'Synthetic Artist',
 trackId:'synthetic-track',releaseId:'synthetic-release',revision:'{}',coverUrl:null,
 editable:!params.has('readonly') && !params.has('published'),
 discoveryEditable:params.has('published') || !params.has('readonly'),
 fields:{title:'Synthetic track',releaseTitle:'Synthetic release',summary:'',genres:['Ambient'],moods:['Calm'],processTags:[]}};
function Harness(){
 const [pending,setPending]=useState(false);
 const [saved,setSaved]=useState(null);
 return <MemoryRouter>
 <button onClick={()=>setPending(p=>!p)}>{pending?'Finish saving':'Start saving'}</button>
 <SubmissionEditor data={data} pending={pending} onSave={form=>setSaved(form.getAll('processTags'))}/>
 <output aria-label="Saved process tags">{JSON.stringify(saved)}</output>
 </MemoryRouter>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
`;

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    resolve: { alias: { "~": path.resolve("app") } },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom/client",
        "react-router",
      ],
      holdUntilCrawlEnd: false,
    },
    server: { host: "127.0.0.1", port: 0 },
    plugins: [
      {
        name: "submission-editor-smoke",
        resolveId(id) {
          if (id === "/__submission-editor-smoke.jsx") return moduleId;
        },
        load(id) {
          if (id === moduleId) return harness;
        },
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            if (new URL(req.url ?? "/", "http://local.test").pathname !== "/") return next();
            res.setHeader("content-type", "text/html");
            res.end(
              '<!DOCTYPE html><html data-theme="dark"><body><div id="root"></div><script type="module" src="/__submission-editor-smoke.jsx"></script></body></html>',
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string")
    throw new Error("Missing editor smoke server address");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await server?.close();
});

test("selects, filters, removes and saves process tags in the editable curator form", async ({
  page,
}) => {
  await page.goto(origin);
  const tags = page.getByRole("group", { name: "Process tags", exact: true });
  await tags.locator("summary").click();
  await tags.getByText("Human composition", { exact: true }).click();
  await expect(
    tags.getByRole("checkbox", { name: "Human composition", exact: true }),
  ).toBeChecked();
  const lyrics = tags.getByRole("checkbox", { name: "Human lyrics", exact: true });
  await lyrics.focus();
  await page.keyboard.press("Space");
  await expect(lyrics).toBeChecked();
  await tags.getByRole("searchbox", { name: "Find process tags" }).fill("Mixing");
  await tags.getByRole("checkbox", { name: "Mixing", exact: true }).check();
  await page.keyboard.press("Escape");
  await tags.getByRole("button", { name: "Remove Human lyrics", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Reason for these changes" })
    .fill("Correct discovery tags");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByLabel("Saved process tags")).toHaveText('["Human composition","Mixing"]');
});

test("keeps read-only dropdowns closed instead of presenting disabled checkboxes", async ({
  page,
}) => {
  await page.goto(origin + "/?readonly");
  const tags = page.getByRole("group", { name: "Process tags", exact: true });
  await expect(
    page.getByText("This submission is closed or already published. Its details are read-only."),
  ).toBeVisible();
  await expect(tags).toContainText("Read-only");
  // aria-disabled does not disable a native summary's mouse activation.
  await tags.locator("summary").click({ force: true });
  await expect(tags.locator("details")).toHaveJSProperty("open", false);
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
});

test("closes an open dropdown while saving and preserves selections when editing resumes", async ({
  page,
}) => {
  await page.goto(origin);
  const tags = page.getByRole("group", { name: "Process tags", exact: true });
  await tags.locator("summary").click();
  await tags.getByRole("checkbox", { name: "Human composition", exact: true }).check();
  await page.getByRole("button", { name: "Start saving", exact: true }).click();
  await expect(tags.locator("details")).toHaveJSProperty("open", false);
  await tags.locator("summary").click({ force: true });
  await expect(tags.locator("details")).toHaveJSProperty("open", false);
  await page.getByRole("button", { name: "Finish saving", exact: true }).click();
  await tags.locator("summary").click();
  await expect(
    tags.getByRole("checkbox", { name: "Human composition", exact: true }),
  ).toBeChecked();
});

test("edits published discovery fields while titles and artwork remain read-only", async ({
  page,
}) => {
  await page.goto(origin + "/?published");
  await expect(
    page.getByRole("heading", { name: "Edit discovery details", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Track title", exact: true })).not.toBeEditable();
  await expect(
    page.getByRole("textbox", { name: "Release title", exact: true }),
  ).not.toBeEditable();
  await expect(
    page.getByRole("textbox", { name: "Release description", exact: true }),
  ).not.toBeEditable();
  await expect(page.getByLabel("Choose or replace cover")).toBeDisabled();
  const tags = page.getByRole("group", { name: "Process tags", exact: true });
  await tags.locator("summary").click();
  await tags.getByRole("checkbox", { name: "AI-assisted composition", exact: true }).check();
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "Reason for these changes" })
    .fill("Correct published process tags");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByLabel("Saved process tags")).toHaveText('["AI-assisted composition"]');
});
