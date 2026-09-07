import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { Header } from "../../app/components/Header";
import { MobileNav } from "../../app/components/MobileNav";
import Home from "../../app/routes/home";
import {
  buildCatalogueNavigation,
  buildCatalogueSections,
  type CatalogueNavigationEntry,
} from "../../app/services/catalogue";
import type {
  CatalogueLoadResult,
  PlayerOutletContext,
  PublicEditorialCollection,
} from "../../app/types/catalogue";
import { makeCatalogueItem } from "../fixtures/catalogue";

const item = makeCatalogueItem("stillith-track");
const fallback: CatalogueNavigationEntry[] = [
  { label: "Listen", to: "/#catalogue" },
  { label: "Search", to: "/search" },
  { label: "About", to: "/#about" },
];
const standard: CatalogueNavigationEntry[] = [
  { label: "Latest", to: "/#latest" },
  { label: "Listen", to: "/#audio" },
  { label: "Watch", to: "/#video" },
  { label: "Search", to: "/search" },
  { label: "About", to: "/#about" },
];

function collection(slug: string): PublicEditorialCollection {
  return { id: slug, slug, name: slug, description: null, items: [item] };
}

function navigationFor(collections: PublicEditorialCollection[]) {
  return buildCatalogueNavigation(buildCatalogueSections([item], collections));
}

function readNavigation(markup: string): { label: string; to: string }[] {
  const nav = markup.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  expect(nav).toBeDefined();
  return [...nav!.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((match) => ({
    label: match[2]!,
    to: match[1]!,
  }));
}

function renderHome(catalogue: CatalogueLoadResult): string {
  const context: PlayerOutletContext = {
    catalogue,
    selectedItemId: null,
    selectItem: () => undefined,
    queueItem: () => undefined,
    playItem: () => undefined,
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route path="/" element={<Home />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("catalogue-aware navigation", () => {
  it("uses generic Listen for custom Stillith collections without inventing editorial sections", () => {
    expect(navigationFor([collection("stillith")])).toEqual(fallback);
    expect(navigationFor([])).toEqual(fallback);
    expect(buildCatalogueNavigation([])).toEqual(fallback);
  });

  it("advertises only existing standard section ids, in a stable order", () => {
    expect(
      navigationFor([
        collection("watch"),
        collection("listen"),
        collection("latest-transmissions"),
      ]),
    ).toEqual(standard);
    expect(navigationFor([collection("latest-transmissions")])).toEqual([standard[0], ...fallback]);
    expect(navigationFor([collection("listen")])).toEqual([standard[1], ...fallback.slice(1)]);
    expect(navigationFor([collection("watch")])).toEqual([
      fallback[0],
      standard[2],
      ...fallback.slice(1),
    ]);
  });

  it("does not mutate sections or duplicate links for repeated section ids", () => {
    const sections = buildCatalogueSections([item], [collection("listen"), collection("listen")]);
    const original = structuredClone(sections);
    expect(buildCatalogueNavigation(sections)).toEqual([standard[1], ...fallback.slice(1)]);
    expect(sections).toEqual(original);
  });

  for (const [name, navigation] of [
    ["fallback", fallback],
    ["standard", standard],
  ] as const) {
    it(`shares exact ${name} destinations across desktop and mobile`, () => {
      const header = renderToStaticMarkup(
        <MemoryRouter>
          <Header navigation={navigation} />
        </MemoryRouter>,
      );
      const mobile = renderToStaticMarkup(
        <MemoryRouter>
          <MobileNav navigation={navigation} />
        </MemoryRouter>,
      );
      expect(readNavigation(header)).toEqual(navigation);
      expect(readNavigation(mobile)).toEqual(navigation);
      expect(mobile).toContain(
        `grid-template-columns:repeat(${navigation.length}, minmax(0, 1fr))`,
      );
      expect(header).toMatch(/href="\/submission-terms"[^>]*>[\s\S]*?Submission terms/);
      expect(header).not.toContain("Reviewed disclosure");
    });
  }

  it("defaults isolated components to only safe generic destinations", () => {
    expect(
      readNavigation(
        renderToStaticMarkup(
          <MemoryRouter>
            <Header />
          </MemoryRouter>,
        ),
      ),
    ).toEqual(fallback);
    expect(
      readNavigation(
        renderToStaticMarkup(
          <MemoryRouter>
            <MobileNav />
          </MemoryRouter>,
        ),
      ),
    ).toEqual(fallback);
  });

  const scenarios: [string, CatalogueLoadResult][] = [
    [
      "custom collection",
      { status: "ready", items: [item], collections: [collection("stillith")] },
    ],
    ["no collections", { status: "ready", items: [item], collections: [] }],
    [
      "standard collections",
      {
        status: "ready",
        items: [item],
        collections: [
          collection("latest-transmissions"),
          collection("listen"),
          collection("watch"),
        ],
      },
    ],
    ["empty", { status: "empty", items: [], collections: [] }],
    ["error", { status: "error", items: [], collections: [], message: "Catalogue unavailable" }],
  ];

  for (const [name, catalogue] of scenarios) {
    it(`renders real homepage targets for every advertised hash in ${name}`, () => {
      const markup = renderHome(catalogue);
      expect(markup.match(/id="catalogue"/g)).toHaveLength(1);
      const navigation =
        catalogue.status === "ready" ? navigationFor(catalogue.collections) : fallback;
      for (const entry of navigation) {
        if (entry.to.startsWith("/#")) {
          expect(markup).toContain(`id="${entry.to.slice(2)}"`);
        }
      }
      if (catalogue.status === "empty")
        expect(markup).toContain("No transmissions are published yet.");
      if (catalogue.status === "error") expect(markup).toContain("Catalogue unavailable");
    });
  }
});
