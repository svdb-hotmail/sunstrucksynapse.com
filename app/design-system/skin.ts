export const SKINS = ["editorial", "underground", "synth"] as const;
export type Skin = (typeof SKINS)[number];
export const SKIN_STORAGE_KEY = "sunsyn-site-skin-v1";
export const DEFAULT_SKIN: Skin = "editorial";
export const showSkinPicker =
  import.meta.env.DEV || ["site-preview", "test"].includes(import.meta.env.MODE);

export function isSkin(value: unknown): value is Skin {
  return SKINS.some((skin) => skin === value);
}

export function chooseSkin(saved: unknown, random: number): Skin {
  if (isSkin(saved)) return saved;
  return SKINS[Math.min(SKINS.length - 1, Math.max(0, Math.floor(random * SKINS.length)))];
}

export function setSkin(skin: Skin, document: Document) {
  document.documentElement.dataset.skin = skin;
  try {
    document.defaultView?.localStorage.setItem(SKIN_STORAGE_KEY, skin);
  } catch {
    // Browsers that block storage still get a skin for this page.
  }
}

/** Run in the head, before styles and React, so navigation never flashes the default skin. */
export const SKIN_INIT_SCRIPT = `(() => {
  const key = ${JSON.stringify(SKIN_STORAGE_KEY)};
  const skins = ${JSON.stringify(SKINS)};
  let saved = null;
  try { saved = window.localStorage.getItem(key); } catch {}
  const requested = new URLSearchParams(window.location.search).get("skin");
  const skin = skins.includes(requested) ? requested : (skins.includes(saved) ? saved : skins[Math.floor(Math.random() * skins.length)]);
  document.documentElement.dataset.skin = skin;
  try { window.localStorage.setItem(key, skin); } catch {}
})();`;
