import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { Header } from "../../app/components/Header";
import { MobileNav } from "../../app/components/MobileNav";
import Home from "../../app/routes/home";
import {
  defaultCatalogueNavigation,
  isCatalogueNavigationEntryActive,
} from "../../app/services/catalogue";
import type { CatalogueLoadResult, PlayerOutletContext } from "../../app/types/catalogue";
import { makeCatalogueItem } from "../fixtures/catalogue";
const item = makeCatalogueItem("stillith-track");
function renderHome(catalogue: CatalogueLoadResult) {
  const context: PlayerOutletContext = {
    catalogue,
    selectedItemId: null,
    selectItem: () => undefined,
    queueItem: () => undefined,
    playItem: () => undefined,
    playSelection: () => undefined,
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route path="/" element={<Home loaderData={{ albums: [] }} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
describe("radio listener navigation", () => {
  it("has stable Listen and Explore destinations for any catalogue size", () => {
    expect(defaultCatalogueNavigation).toEqual([
      { label: "Listen", to: "/" },
      { label: "Explore", to: "/search" },
    ]);
    expect(isCatalogueNavigationEntryActive(defaultCatalogueNavigation[0], "/")).toBe(true);
    expect(isCatalogueNavigationEntryActive(defaultCatalogueNavigation[0], "/search")).toBe(false);
    expect(isCatalogueNavigationEntryActive(defaultCatalogueNavigation[1], "/search")).toBe(true);
    expect(isCatalogueNavigationEntryActive(defaultCatalogueNavigation[1], "/about")).toBe(false);
  });
  it("exposes matching destinations and a labelled queue count in both navigation surfaces", () => {
    for (const Navigation of [Header, MobileNav]) {
      const markup = renderToStaticMarkup(
        <MemoryRouter initialEntries={["/search"]}>
          <Navigation queueCount={2} />
        </MemoryRouter>,
      );
      expect(markup).toContain('href="/"');
      expect(markup).toContain('href="/search"');
      expect(markup).toMatch(/<a\b(?=[^>]*href="\/search")(?=[^>]*aria-current="page")[^>]*>/);
      expect(markup).toContain('aria-label="Queue, 2 tracks"');
      expect(markup).not.toContain("/#audio");
      expect(markup).not.toContain("/#video");
    }
  });
  it("keeps platform identity visible on the header and About outside primary mobile tabs", () => {
    const header = renderToStaticMarkup(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );
    const mobile = renderToStaticMarkup(
      <MemoryRouter>
        <MobileNav />
      </MemoryRouter>,
    );
    expect(header).toContain("SunSyn Radio");
    expect(header).toContain('href="/about"');
    expect(mobile).not.toContain('href="/about"');
    expect(mobile).toContain('aria-label="Queue, 0 tracks"');
  });
  it("uses published collection data without fabricating standard collections", () => {
    const markup = renderHome({
      status: "ready",
      items: [item],
      collections: [
        { id: "stillith", slug: "stillith", name: "Stillith", description: null, items: [item] },
      ],
    });
    expect(markup).toContain("Start listening.");
    expect(markup).toContain('href="/collections/stillith"');
    expect(markup).not.toContain('id="audio"');
    expect(markup).not.toContain('id="video"');
    expect(markup).toContain(item.description.title);
  });
  it("still offers the published catalogue without collections", () => {
    const markup = renderHome({ status: "ready", items: [item], collections: [] });
    expect(markup).toContain(item.description.title);
    expect(markup).toContain("Play the selection");
  });
  it("bounds homepage tracks while retaining an Explore destination", () => {
    const markup = renderHome({
      status: "ready",
      items: Array.from({ length: 12 }, (_, i) => makeCatalogueItem(`track-${i}`)),
      collections: [],
    });
    expect(markup.match(/class="media-card listener-track"/g)).toHaveLength(6);
    expect(markup).toContain('href="/search"');
  });
  for (const state of [
    { status: "empty", items: [], collections: [] },
    { status: "error", items: [], collections: [], message: "Try again later." },
  ] satisfies CatalogueLoadResult[]) {
    it(`keeps ${state.status} state actionable and cannot start missing media`, () => {
      const markup = renderHome(state);
      expect(markup).toContain('disabled=""');
      expect(markup).not.toContain('class="media-card listener-track"');
      expect(markup).toContain(
        state.status === "empty" ? "No transmissions are published yet." : "Try again later.",
      );
    });
  }
});
