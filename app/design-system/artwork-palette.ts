import type { CSSProperties } from "react";
import type { ArtworkPalette } from "../services/artwork-palette";
export type { ArtworkPalette } from "../services/artwork-palette";

export function paletteStyle(palette: ArtworkPalette): CSSProperties {
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
