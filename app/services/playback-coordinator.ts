import { isR2MediaUrl, resolveFreshPlaybackUrl } from "~/services/media-signing";
import type { CatalogueItem } from "~/types/catalogue";

export interface PlaybackMediaElement {
  src: string;
  currentTime: number;
  paused: boolean;
  load(): void;
  play(): Promise<void>;
  pause(): void;
}

export interface PlaybackCoordinatorOptions {
  resolveUrl?: (src: string) => Promise<string>;
  onActiveSrcChange?: (src: string | null, itemId: string | null) => void;
  onErrorChange?: (error: string | null) => void;
  onLoadingChange?: (loading: boolean) => void;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

export class PlaybackCoordinator {
  private item: CatalogueItem | null = null;
  private media: PlaybackMediaElement | null = null;
  private generation = 0;
  private isInternalPlay = false;
  private loading = false;
  private resolveUrl: (src: string) => Promise<string>;
  private onActiveSrcChange?: (src: string | null, itemId: string | null) => void;
  private onErrorChange?: (error: string | null) => void;
  private onLoadingChange?: (loading: boolean) => void;

  constructor(options: PlaybackCoordinatorOptions = {}) {
    this.resolveUrl = options.resolveUrl ?? resolveFreshPlaybackUrl;
    this.onActiveSrcChange = options.onActiveSrcChange;
    this.onErrorChange = options.onErrorChange;
    this.onLoadingChange = options.onLoadingChange;
  }

  attachMedia(media: PlaybackMediaElement | null): void {
    this.media = media;
  }

  isLoading(): boolean {
    return this.loading;
  }

  selectItem(item: CatalogueItem | null): void {
    if (this.itemsMatch(this.item, item)) {
      this.item = item;
      return;
    }

    this.generation += 1;
    this.item = item;
    this.isInternalPlay = false;
    this.onErrorChange?.(null);
    this.setLoading(false);

    if (!item?.media) {
      this.onActiveSrcChange?.(null, item?.id ?? null);
      if (this.media) {
        this.media.pause();
        this.media.currentTime = 0;
        this.media.src = "";
      }
      return;
    }

    // Set canonical source without fetching or minting expiring signed URLs on selection
    // Do NOT trigger media loading on selection
    this.onActiveSrcChange?.(item.media.src, item.id);
    if (this.media) {
      this.media.pause();
      this.media.currentTime = 0;
      this.media.src = item.media.src;
    }
  }

  async playRequested(item: CatalogueItem): Promise<void> {
    this.selectItem(item);
    this.item = item;
    const generation = ++this.generation;
    const media = this.media;
    this.isInternalPlay = false;
    this.onErrorChange?.(null);
    this.setLoading(true);

    if (!item.media) {
      if (this.generation === generation) {
        this.setLoading(false);
      }
      return;
    }

    try {
      let activeSrc = item.media.src;
      if (isR2MediaUrl(activeSrc)) {
        activeSrc = await this.resolveUrl(activeSrc);
        if (this.generation !== generation || this.media !== media) {
          return;
        }
        this.onActiveSrcChange?.(activeSrc, item.id);
      }

      if (media && this.generation === generation && this.media === media) {
        if (isR2MediaUrl(item.media.src)) {
          media.src = activeSrc;
        }
        media.load();
        this.isInternalPlay = true;
        try {
          await media.play();
        } finally {
          if (this.generation === generation) {
            this.isInternalPlay = false;
          }
        }
      }
    } catch (error) {
      if (this.generation === generation && !isAbortError(error)) {
        this.onErrorChange?.(
          "Playback could not be loaded or started automatically. Use the player controls to begin.",
        );
      }
    } finally {
      if (this.generation === generation) {
        this.setLoading(false);
      }
    }
  }

  async handleNativePlay(): Promise<void> {
    if (this.isInternalPlay || !this.item?.media) {
      return;
    }

    if (!isR2MediaUrl(this.item.media.src)) {
      return;
    }

    this.onErrorChange?.(null);
    this.setLoading(true);
    const media = this.media;
    const itemId = this.item.id;
    const generation = ++this.generation;

    try {
      const savedTime = media ? media.currentTime : 0;
      if (media && !media.paused) {
        media.pause();
      }

      const freshUrl = await this.resolveUrl(this.item.media.src);
      if (this.generation !== generation || this.item?.id !== itemId || this.media !== media) {
        return;
      }
      this.onActiveSrcChange?.(freshUrl, itemId);

      if (media) {
        media.src = freshUrl;
        media.load();
        if (savedTime > 0) {
          media.currentTime = savedTime;
        }
        this.isInternalPlay = true;
        try {
          await media.play();
        } finally {
          if (this.generation === generation) {
            this.isInternalPlay = false;
          }
        }
      }
    } catch (error) {
      if (this.generation === generation && !isAbortError(error)) {
        this.onErrorChange?.("This preview could not be loaded. Check your connection and retry.");
      }
    } finally {
      if (this.generation === generation) {
        this.setLoading(false);
      }
    }
  }

  async retry(): Promise<void> {
    const item = this.item;
    if (!item?.media) {
      return;
    }

    this.onErrorChange?.(null);
    this.setLoading(true);
    const media = this.media;
    const itemMedia = item.media;
    const generation = ++this.generation;

    try {
      const itemId = item.id;
      let freshSrc = itemMedia.src;
      if (isR2MediaUrl(freshSrc)) {
        freshSrc = await this.resolveUrl(freshSrc);
        if (this.generation !== generation || this.item?.id !== itemId || this.media !== media) {
          return;
        }
        this.onActiveSrcChange?.(freshSrc, itemId);
      }

      if (media && this.generation === generation && this.media === media) {
        const savedTime = media.currentTime;
        if (isR2MediaUrl(itemMedia.src)) {
          media.src = freshSrc;
        }
        media.load();
        if (savedTime > 0) {
          media.currentTime = savedTime;
        }
        this.isInternalPlay = true;
        try {
          await media.play();
        } finally {
          if (this.generation === generation) {
            this.isInternalPlay = false;
          }
        }
      }
    } catch (error) {
      if (this.generation === generation && !isAbortError(error)) {
        this.onErrorChange?.("Playback is still unavailable. Check your connection and try again.");
      }
    } finally {
      if (this.generation === generation) {
        this.setLoading(false);
      }
    }
  }

  private itemsMatch(left: CatalogueItem | null, right: CatalogueItem | null): boolean {
    return (
      left?.id === right?.id &&
      left?.mediaKind === right?.mediaKind &&
      left?.media?.src === right?.media?.src &&
      left?.media?.mimeType === right?.media?.mimeType
    );
  }

  private setLoading(loading: boolean): void {
    this.loading = loading;
    this.onLoadingChange?.(loading);
  }
}
