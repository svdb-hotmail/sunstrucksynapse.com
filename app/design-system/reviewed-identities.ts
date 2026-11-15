import type { ArtworkPalette, PublicArtworkPalette } from "../services/artwork-palette";

export const reviewedIdentityPalettes: Readonly<Record<string, ArtworkPalette>> = {
  "phase-zero-transmissions": {
    accent: "#a34722",
    paperLight: "#eee2cf",
    paperDark: "#241c1a",
    surfaceLight: "#f7eddf",
    surfaceDark: "#342622",
    inkLight: "#2b1d19",
    inkDark: "#f8eddf",
  },
  "sunstruck-synapse": {
    accent: "#a34722",
    paperLight: "#eee2cf",
    paperDark: "#241c1a",
    surfaceLight: "#f7eddf",
    surfaceDark: "#342622",
    inkLight: "#2b1d19",
    inkDark: "#f8eddf",
  },
  "preview-aster": {
    accent: "#216d80",
    paperLight: "#dfece9",
    paperDark: "#122a31",
    surfaceLight: "#eff8f5",
    surfaceDark: "#1d3a42",
    inkLight: "#15343b",
    inkDark: "#eaf6f4",
  },
  "preview-aster-release": {
    accent: "#216d80",
    paperLight: "#dfece9",
    paperDark: "#122a31",
    surfaceLight: "#eff8f5",
    surfaceDark: "#1d3a42",
    inkLight: "#15343b",
    inkDark: "#eaf6f4",
  },
  "preview-vesper": {
    accent: "#7541a3",
    paperLight: "#ebe3f2",
    paperDark: "#21152c",
    surfaceLight: "#f6effb",
    surfaceDark: "#332044",
    inkLight: "#30203a",
    inkDark: "#f5eefa",
  },
  "preview-vesper-release": {
    accent: "#7541a3",
    paperLight: "#ebe3f2",
    paperDark: "#21152c",
    surfaceLight: "#f6effb",
    surfaceDark: "#332044",
    inkLight: "#30203a",
    inkDark: "#f5eefa",
  },
};

export const reviewedIdentitySlugs = Object.keys(reviewedIdentityPalettes);

/** Asset overrides take precedence over reviewed catalogue identities. */
export function identityPalette(
  slug: string,
  artworkPalette?: PublicArtworkPalette | null,
): ArtworkPalette | undefined {
  return artworkPalette?.source === "override"
    ? artworkPalette.colors
    : (reviewedIdentityPalettes[slug] ?? artworkPalette?.colors);
}
