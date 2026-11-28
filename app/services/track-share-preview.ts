import { SITE_URL } from "../config/brand";
import type { CatalogueItem } from "../types/catalogue";

export const SHARE_PREVIEW_SECONDS = 30;
export const SHARE_PREVIEW_SIZE = 640;
export const SHARE_PREVIEW_TYPE = "video/mp4";

export async function trackSharePreview(item: CatalogueItem) {
  if (!item.media) return null;
  const source = new URL(item.media.src, SITE_URL);
  const artwork = new URL(item.artwork.src, SITE_URL);
  if (
    source.origin !== SITE_URL ||
    artwork.origin !== SITE_URL ||
    artwork.pathname.endsWith(".svg")
  ) {
    return null;
  }

  // Managed artwork URLs have a changing signature but an immutable asset ID in the path.
  if (artwork.pathname.startsWith("/media/artwork/")) artwork.search = "";
  const identity = JSON.stringify([item.id, source.href, artwork.href]);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const version = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const file = `${version}.mp4`;
  return {
    file,
    path: `${item.href}/share/${file}`,
    key: `public/share-previews/v1/${file}`,
    sourceUrl: source.href,
    artworkUrl: artwork.href,
  };
}
