import { describe, expect, it } from "vitest";
import {
  ALGORITHM_VERSION,
  contrastRatio,
  parseArtworkPalette,
  parsePublicArtworkPalette,
} from "../../app/services/artwork-palette";

const colors = {
  accent: "#804050",
  paperLight: "#faf7f1",
  surfaceLight: "#ffffff",
  inkLight: "#211b24",
  paperDark: "#0e1019",
  surfaceDark: "#1e202a",
  inkDark: "#f7f3f2",
};

describe("durable artwork palette contract", () => {
  it("accepts seven contrast-checked colors and returns only known keys", () => {
    expect(parseArtworkPalette({ ...colors, objectKey: "private/not-public" })).toEqual(colors);
    expect(
      parsePublicArtworkPalette({ version: ALGORITHM_VERSION, source: "generated", colors }),
    ).toEqual({ version: 1, source: "generated", colors });
    expect(parsePublicArtworkPalette({ version: 1, source: "override", colors })?.source).toBe(
      "override",
    );
  });

  it("rejects absent colors, arbitrary CSS and unsupported contracts", () => {
    for (const value of [
      null,
      [],
      {},
      { ...colors, accent: "red" },
      { ...colors, paperLight: "var(--paper)" },
      { ...colors, inkDark: "#fff" },
      { ...colors, surfaceLight: null },
    ])
      expect(parseArtworkPalette(value)).toBeNull();
    expect(parsePublicArtworkPalette({ version: 2, source: "generated", colors })).toBeNull();
    expect(parsePublicArtworkPalette({ version: 1, source: "browser", colors })).toBeNull();
  });

  it("rejects unreadable text on either theme surface and white button text", () => {
    for (const changes of [
      { inkLight: colors.paperLight },
      { surfaceLight: colors.inkLight },
      { inkDark: colors.paperDark },
      { surfaceDark: colors.inkDark },
      { accent: "#ffffff" },
    ])
      expect(parseArtworkPalette({ ...colors, ...changes })).toBeNull();
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("invalid", "#ffffff")).toBe(0);
  });
});
