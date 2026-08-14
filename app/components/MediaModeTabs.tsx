import type { MediaKind } from "~/types/catalogue";

interface MediaModeTabsProps {
  mode: MediaKind;
  onModeChange: (mode: MediaKind) => void;
}

export function MediaModeTabs({ mode, onModeChange }: MediaModeTabsProps) {
  return (
    <div className="media-mode-tabs" aria-label="Media type">
      {(["audio", "video"] as const).map((mediaKind) => (
        <button
          type="button"
          className={mode === mediaKind ? "active" : undefined}
          aria-pressed={mode === mediaKind}
          onClick={() => onModeChange(mediaKind)}
          key={mediaKind}
        >
          {mediaKind === "audio" ? "Audio" : "Video"}
        </button>
      ))}
    </div>
  );
}
