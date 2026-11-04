import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import About, { meta as aboutMeta } from "../../app/routes/about";
import Home from "../../app/routes/home";
import { SITE_DESCRIPTION, SITE_URL } from "../../app/config/brand";
import type {
  CatalogueLoadResult,
  PlayerOutletContext,
  PublicEditorialCollection,
} from "../../app/types/catalogue";
import { makeCatalogueItem } from "../fixtures/catalogue";

const item = makeCatalogueItem("stillith-track");

function collection(slug: string): PublicEditorialCollection {
  return { id: slug, slug, name: slug, description: null, items: [item] };
}

function renderRoute(element: ReactNode): string {
  const catalogue: CatalogueLoadResult = {
    status: "ready",
    items: [item],
    collections: [collection("listen")],
  };
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
          <Route path="/" element={element} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("about route composition", () => {
  it("keeps the About route metadata exact", () => {
    expect(aboutMeta({} as Parameters<typeof aboutMeta>[0])).toEqual([
      { title: "About | SunSyn Radio" },
      {
        name: "description",
        content: SITE_DESCRIPTION,
      },
      {
        tagName: "link",
        rel: "canonical",
        href: new URL("/about", SITE_URL).href,
      },
      {
        property: "og:url",
        content: new URL("/about", SITE_URL).href,
      },
    ]);
  });

  it("keeps Offerings and Contact off the home route", () => {
    const markup = renderRoute(<Home />);

    expect(markup).not.toContain('id="about"');
    expect(markup).not.toContain('id="contact"');
    expect(markup).not.toContain("What guides us");
    expect(markup).not.toContain("Send the signal.");
  });

  it("renders a concise About page with three goals, policy answers, and modal contact", () => {
    const markup = renderRoute(<About />);

    expect(markup).toContain("<h1>Music chosen by people, made with intent.</h1>");
    expect(markup).toContain("SunSyn Radio is a human-curated place");
    expect(markup).toContain('id="about"');
    expect(markup).toContain("What guides us");
    expect(markup.match(/<article>/g)).toHaveLength(3);
    expect(markup).toContain("Choose with care");
    expect(markup).toContain("Use tools deliberately");
    expect(markup).toContain("Credit responsibility");
    expect(markup).not.toContain("Listening first");
    expect(markup).not.toContain(">04<");

    expect(markup).toContain("Policy questions");
    expect(markup.match(/<details>/g)).toHaveLength(3);
    expect(markup).toContain("How is personal information handled?");
    expect(markup).toContain("What should I know before submitting work?");
    expect(markup).toContain("How do I report a rights concern?");

    for (const [href, name] of [
      ["/privacy", "Read the privacy notice"],
      ["/submission-terms", "Read the submission terms"],
      ["/takedown", "Read the takedown process"],
    ] as const) {
      expect(markup).toMatch(new RegExp(`href="${href}"[^>]*>${name}<`));
    }

    expect(markup).toContain(">Contact SunSyn</button>");
    expect(markup).toContain('<dialog class="contact-dialog"');
    expect(markup).toContain('id="contact"');

    expect(markup).toContain('action="mailto:hello@sunstrucksynapse.com"');
    expect(markup).toContain('method="get"');
    expect(markup).toContain('name="name"');
    expect(markup).toContain('autoComplete="name"');
    expect(markup).toContain('name="email"');
    expect(markup).toContain('autoComplete="email"');
    expect(markup).toContain('type="email"');
    expect(markup).toContain('name="subject"');
    expect(markup).toContain("Choose one");
    expect(markup).toContain("The radio");
    expect(markup).toContain("Music or artist");
    expect(markup).toContain("Visual work");
    expect(markup).toContain("Collaboration");
    expect(markup).toContain('name="message"');
    expect(markup).toContain('rows="5"');
    expect(markup).toContain("Launch message");
  });
});
