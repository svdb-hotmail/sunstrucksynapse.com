/** Versioned, JSON-only palette contract shared by projection and background work. */
export const ALGORITHM_VERSION = 1 as const;

export interface ArtworkPalette {
  accent: string;
  paperLight: string;
  paperDark: string;
  surfaceLight: string;
  surfaceDark: string;
  inkLight: string;
  inkDark: string;
}

export interface PublicArtworkPalette {
  version: typeof ALGORITHM_VERSION;
  source: "generated" | "override";
  colors: ArtworkPalette;
}

const keys: (keyof ArtworkPalette)[] = [
  "accent",
  "paperLight",
  "paperDark",
  "surfaceLight",
  "surfaceDark",
  "inkLight",
  "inkDark",
];
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  if (!isHex(first) || !isHex(second)) return 0;
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function parseArtworkPalette(value: unknown): ArtworkPalette | null {
  if (!isObject(value) || keys.some((key) => !isHex(value[key]))) return null;
  const colors = Object.fromEntries(
    keys.map((key) => [key, (value[key] as string).toLowerCase()]),
  ) as unknown as ArtworkPalette;
  if (
    contrastRatio(colors.inkLight, colors.paperLight) < 4.5 ||
    contrastRatio(colors.inkLight, colors.surfaceLight) < 4.5 ||
    contrastRatio(colors.inkDark, colors.paperDark) < 4.5 ||
    contrastRatio(colors.inkDark, colors.surfaceDark) < 4.5 ||
    contrastRatio("#ffffff", colors.accent) < 4.5
  )
    return null;
  return colors;
}

export function parsePublicArtworkPalette(value: unknown): PublicArtworkPalette | null {
  if (
    !isObject(value) ||
    value.version !== ALGORITHM_VERSION ||
    (value.source !== "generated" && value.source !== "override")
  )
    return null;
  const colors = parseArtworkPalette(value.colors);
  return colors ? { version: ALGORITHM_VERSION, source: value.source, colors } : null;
}
