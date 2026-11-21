import { paletteStyle } from "./artwork-palette";
import type { PublicArtworkPalette } from "../services/artwork-palette";
import { identityPalette, reviewedIdentityPalettes } from "./reviewed-identities";

export type IdentityTreatment =
  "neutral" | "palette" | "expressive" | "nocturne" | "collage" | "signal";

export const showIdentityPreview =
  import.meta.env.DEV || ["site-preview", "test"].includes(import.meta.env.MODE);

/** Manual, reviewed tokens. Unknown catalogue entries use the shared neutral design. */
export function identityStyle(slug: string, artworkPalette?: PublicArtworkPalette | null) {
  const palette = identityPalette(slug, artworkPalette);
  if (!palette) return undefined;
  return paletteStyle(palette);
}

export function defaultIdentityTreatment(slug: string): IdentityTreatment {
  return reviewedIdentityPalettes[slug] ? "palette" : "neutral";
}
