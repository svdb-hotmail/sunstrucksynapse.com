import type { Artwork as ArtworkValue } from "~/types/catalogue";

/** Real covers remain images. The labelled design preview reuses its approved CSS artwork. */
export function Artwork({
  artwork,
  size = 52,
  decorative = false,
}: {
  artwork: ArtworkValue;
  size?: number;
  decorative?: boolean;
}) {
  const variant =
    import.meta.env.MODE === "site-preview"
      ? (
          {
            "/assets/design-preview/signal.svg": "signal",
            "/assets/design-preview/bloom.svg": "bloom",
          } as Record<string, string>
        )[artwork.src]
      : undefined;
  return variant ? (
    <div
      className={`artwork artwork--${variant}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : artwork.alt}
      aria-hidden={decorative || undefined}
    >
      <div className="artwork-orbit" />
      <div className="artwork-core" />
      <span>SS / {variant === "signal" ? "01" : "02"}</span>
    </div>
  ) : (
    <img
      className="artwork"
      src={artwork.src}
      alt={decorative ? "" : artwork.alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  );
}
