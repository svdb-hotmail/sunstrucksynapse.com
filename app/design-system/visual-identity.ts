import type { CSSProperties } from "react";

export type IdentityTreatment = "neutral" | "palette" | "expressive";

interface IdentityPalette {
  accent: string;
  paperLight: string;
  paperDark: string;
  surfaceLight: string;
  surfaceDark: string;
  inkLight: string;
  inkDark: string;
}

const identities: Record<string, IdentityPalette> = {
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

export const showIdentityPreview =
  import.meta.env.DEV || ["site-preview", "test"].includes(import.meta.env.MODE);

/** Manual, reviewed tokens. Unknown catalogue entries use the shared neutral design. */
export function identityStyle(slug: string): CSSProperties | undefined {
  const palette = identities[slug];
  if (!palette) return undefined;
  return {
    "--identity-accent": palette.accent,
    "--identity-paper-light": palette.paperLight,
    "--identity-paper-dark": palette.paperDark,
    "--identity-surface-light": palette.surfaceLight,
    "--identity-surface-dark": palette.surfaceDark,
    "--identity-ink-light": palette.inkLight,
    "--identity-ink-dark": palette.inkDark,
  } as CSSProperties;
}

export function defaultIdentityTreatment(slug: string): IdentityTreatment {
  return identities[slug] ? "palette" : "neutral";
}
