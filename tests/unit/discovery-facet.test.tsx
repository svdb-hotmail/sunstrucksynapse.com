import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryFacet } from "../../app/components/DiscoveryFacet";

const facets = [
  { name: "genre", label: "Genre", allLabel: "All genres", value: "ambient" },
  { name: "mood", label: "Mood", allLabel: "All moods", value: "calm" },
  { name: "year", label: "Year", allLabel: "All years", value: 2026 },
  { name: "process", label: "Creative process", allLabel: "All processes", value: "ai-texture" },
] as const;

function control(markup: string) {
  const select = markup.match(/<select\b([^>]*)>([\s\S]*?)<\/select>/);
  expect(select).not.toBeNull();
  return { attributes: select![1]!, options: select![2]! };
}

describe("discovery facet controls", () => {
  for (const facet of facets) {
    it(`disables empty ${facet.name} with visible associated help outside its label`, () => {
      const markup = renderToStaticMarkup(
        <DiscoveryFacet {...facet} options={[]} selectedValue="" />,
      );
      const select = control(markup);
      expect(select.attributes).toContain('disabled=""');
      expect(select.options).toMatch(new RegExp(`value=""[^>]*>${facet.allLabel}</option>`));
      expect(select.options.match(/<option\b/g)).toHaveLength(1);
      const helpId = select.attributes.match(/aria-describedby="([^"]+)"/)?.[1];
      expect(helpId).toBeDefined();
      expect(markup).toContain(
        `<p id="${helpId}">No ${facet.label.toLowerCase()} values are available for published tracks.</p>`,
      );
      const label = markup.match(/<label\b[^>]*>([\s\S]*?)<\/label>/)?.[1];
      expect(label).toMatch(new RegExp(`^${facet.label}<select`));
      expect(label).not.toContain("No ");
    });

    it(`preserves unavailable ${facet.name} selection and enables clearing`, () => {
      const markup = renderToStaticMarkup(
        <DiscoveryFacet {...facet} options={[]} selectedValue={facet.value} />,
      );
      const select = control(markup);
      expect(select.attributes).not.toContain("disabled");
      expect(select.options).toContain(
        `<option value="${facet.value}" selected="">${facet.value} (unavailable)</option>`,
      );
      expect(select.options).toContain(`<option value="">${facet.allLabel}</option>`);
      expect(select.attributes).toContain("aria-describedby=");
      expect(markup).toContain("The selected value is not available in the current catalogue.");
    });

    it(`preserves valid ${facet.name} values without duplicating the selected option`, () => {
      const markup = renderToStaticMarkup(
        <DiscoveryFacet {...facet} options={[facet.value]} selectedValue={facet.value} />,
      );
      const select = control(markup);
      expect(select.attributes).not.toContain("disabled");
      expect(select.attributes).not.toContain("aria-describedby");
      expect(select.options).toContain(
        `<option value="${facet.value}" selected="">${facet.value}</option>`,
      );
      expect(select.options.match(/<option\b/g)).toHaveLength(2);
      expect(markup).not.toContain("unavailable");
    });
  }

  it("retains an unknown selected value alongside existing metadata options", () => {
    const markup = renderToStaticMarkup(
      <DiscoveryFacet
        name="genre"
        label="Genre"
        allLabel="All genres"
        options={["folk", "ambient"]}
        selectedValue="unknown-genre"
      />,
    );
    const select = control(markup);
    expect(select.attributes).not.toContain("disabled");
    expect(select.options).toContain(
      '<option value="unknown-genre" selected="">unknown-genre (unavailable)</option>',
    );
    expect(select.options).toContain('<option value="folk">folk</option>');
    expect(select.options).toContain('<option value="ambient">ambient</option>');
  });

  for (const unavailableCount of [0, 2, 4]) {
    it(`disables only empty controls when ${unavailableCount} of four facets lack metadata`, () => {
      const markup = renderToStaticMarkup(
        <form>
          {facets.map((facet, index) => (
            <DiscoveryFacet
              key={facet.name}
              {...facet}
              options={index < unavailableCount ? [] : [facet.value]}
              selectedValue={null}
            />
          ))}
        </form>,
      );
      const selects = [...markup.matchAll(/<select\b([^>]*)>/g)];
      expect(selects).toHaveLength(4);
      expect(selects.filter((select) => select[1]!.includes('disabled=""'))).toHaveLength(
        unavailableCount,
      );
      const ids = selects.map((select) => select[1]!.match(/\bid="([^"]+)"/)?.[1]);
      expect(new Set(ids).size).toBe(4);
    });
  }
});
