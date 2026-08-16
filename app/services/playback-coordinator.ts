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

export class PlaybackCoordinator {
  private item: CatalogueItem | null = null;
  private media: PlaybackMediaElement | null = null;
  private isInternalPlay = false;
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

  selectItem(item: CatalogueItem | null): void {
    this.item = item;
    this.isInternalPlay = false;
    this.onErrorChange?.(null);
    this.onLoadingChange?.(false);

    if (!item?.media) {
      this.onActiveSrcChange?.(null, item?.id ?? null);
      if (this.media) {
        this.media.src = "";
      }
      return;
    }

    // Set canonical source without fetching or minting expiring signed URLs on selection
    // Do NOT trigger media loading on selection
    this.onActiveSrcChange?.(item.media.src, item.id);
    if (this.media) {
      this.media.src = item.media.src;
    }
  }

  async playRequested(item: CatalogueItem): Promise<void> {
    this.item = item;
    this.onErrorChange?.(null);
    this.onLoadingChange?.(true);

    if (!item.media) {
      this.onLoadingChange?.(false);
      return;
    }

    try {
      let activeSrc = item.media.src;
      if (isR2MediaUrl(activeSrc)) {
        activeSrc = await this.resolveUrl(activeSrc);
        if (this.item?.id !== item.id) {
          return;
        }
        this.onActiveSrcChange?.(activeSrc, item.id);
      }

      if (this.media) {
        if (isR2MediaUrl(item.media.src)) {
          this.media.src = activeSrc;
        }
        this.media.load();
        this.isInternalPlay = true;
        try {
          await this.media.play();
        } finally {
          this.isInternalPlay = false;
        }
      }
    } catch {
      this.onErrorChange?.(
        "Playback could not be loaded or started automatically. Use the player controls to begin.",
      );
    } finally {
      this.onLoadingChange?.(false);
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
    this.onLoadingChange?.(true);
    const media = this.media;
    const itemId = this.item.id;

    try {
      const savedTime = media ? media.currentTime : 0;
      if (media && !media.paused) {
        media.pause();
      }

      const freshUrl = await this.resolveUrl(this.item.media.src);
      if (this.item?.id !== itemId) {
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
          this.isInternalPlay = false;
        }
      }
    } catch {
      this.onErrorChange?.("This preview could not be loaded. Check your connection and retry.");
    } finally {
      this.onLoadingChange?.(false);
    }
  }

  async retry(): Promise<void> {
    const item = this.item;
    if (!item?.media) {
      return;
    }

    this.onErrorChange?.(null);
    this.onLoadingChange?.(true);
    const media = this.media;
    const itemMedia = item.media;

    try {
      const itemId = item.id;
      let freshSrc = itemMedia.src;
      if (isR2MediaUrl(freshSrc)) {
        freshSrc = await this.resolveUrl(freshSrc);
        if (this.item?.id !== itemId) {
          return;
        }
        this.onActiveSrcChange?.(freshSrc, itemId);
      }

      if (media) {
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
          this.isInternalPlay = false;
        }
      }
    } catch {
      this.onErrorChange?.("Playback is still unavailable. Check your connection and try again.");
    } finally {
      this.onLoadingChange?.(false);
    }
  }
}
