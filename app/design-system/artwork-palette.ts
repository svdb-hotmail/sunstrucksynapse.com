import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

export interface ArtworkPalette {
  accent: string;
  paperLight: string;
  paperDark: string;
  surfaceLight: string;
  surfaceDark: string;
  inkLight: string;
  inkDark: string;
}

const hex = (value: number) => Math.round(value).toString(16).padStart(2, "0");
const color = (rgb: number[]) => `#${rgb.map(hex).join("")}`;
const blend = (rgb: number[], target: number[], amount: number) =>
  rgb.map((channel, index) => channel * (1 - amount) + target[index] * amount);

export function extractArtworkPalette(image: HTMLImageElement): ArtworkPalette | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 48;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(image, 0, 0, 48, 48);
    const pixels = context.getImageData(0, 0, 48, 48).data;
    const buckets = new Map<string, { count: number; sum: number[] }>();
    for (let i = 0; i < pixels.length; i += 16) {
      if (pixels[i + 3] < 192) continue;
      const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
      const key = rgb.map((channel) => Math.floor(channel / 32)).join("-");
      const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] };
      bucket.count++;
      rgb.forEach((channel, index) => (bucket.sum[index] += channel));
      buckets.set(key, bucket);
    }
    const candidates = [...buckets.values()].filter((bucket) => bucket.count >= 2);
    if (!candidates.length) return null;
    const weighted = candidates.map((bucket) => {
      const rgb = bucket.sum.map((value) => value / bucket.count);
      const saturation = Math.max(...rgb) - Math.min(...rgb);
      return { rgb, score: bucket.count * (0.35 + saturation / 255) };
    });
    weighted.sort((a, b) => b.score - a.score);
    const base = weighted[0].rgb;
    const vivid = weighted.find(({ rgb }) => Math.max(...rgb) - Math.min(...rgb) > 45)?.rgb ?? base;
    return {
      accent: color(blend(vivid, [80, 52, 90], 0.25)),
      paperLight: color(blend(base, [250, 247, 241], 0.88)),
      surfaceLight: color(blend(base, [255, 255, 255], 0.94)),
      inkLight: "#211b24",
      paperDark: color(blend(base, [14, 16, 25], 0.84)),
      surfaceDark: color(blend(base, [30, 32, 42], 0.78)),
      inkDark: "#f7f3f2",
    };
  } catch {
    return null;
  }
}

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

export function useArtworkPalette(src: string | undefined): ArtworkPalette | null {
  const [palette, setPalette] = useState<ArtworkPalette | null>(null);
  useEffect(() => {
    setPalette(null);
    if (!src || src.endsWith("/favicon.svg")) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setPalette(extractArtworkPalette(image));
    };
    image.onerror = () => {
      if (active) setPalette(null);
    };
    image.src = src;
    return () => {
      active = false;
    };
  }, [src]);
  return palette;
}
