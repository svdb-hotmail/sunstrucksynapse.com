import type { CatalogueItem } from "../../app/types/catalogue";

export function makeCatalogueItem(
  id: string,
  options: { media?: boolean; mediaKind?: "audio" | "video" } = {},
): CatalogueItem {
  const mediaKind = options.mediaKind ?? "audio";
  const base = {
    id,
    slug: id,
    creator: {
      id: "artist-id",
      slug: "test-artist",
      name: "Test Artist",
      role: "Artist",
      href: "/artists/test-artist",
    },
    release: {
      id: "release-id",
      slug: "test-release",
      title: "Test Release",
      href: "/releases/test-release",
    },
    href: `/tracks/test-release/${id}`,
    artwork: {
      src: `/assets/thumbs/${id}.svg`,
      alt: `${id} artwork`,
    },
    description: {
      title: id,
      subtitle: "Test Release · Test Artist",
    },
  };

  if (mediaKind === "video") {
    return {
      ...base,
      mediaKind,
      media:
        options.media === false
          ? undefined
          : { src: `/assets/video/${id}.mp4`, mimeType: "video/mp4" },
    };
  }

  return {
    ...base,
    mediaKind,
    media:
      options.media === false
        ? undefined
        : { src: `/assets/audio/${id}.mp3`, mimeType: "audio/mpeg" },
  };
}
