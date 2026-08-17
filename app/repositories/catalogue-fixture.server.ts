import { createStaticCatalogueRepository } from "~/repositories/catalogue.server";
import type { CatalogueItem, MediaKind } from "~/types/catalogue";
import type { PublicTrackDisclosure } from "~/types/submissions";

const artist = {
  id: "10000000-0000-4000-8000-000000000101",
  slug: "sunstruck-synapse",
  name: "Sunstruck Synapse",
  role: "Artist",
  href: "/artists/sunstruck-synapse",
};

const release = {
  id: "20000000-0000-4000-8000-000000000101",
  slug: "phase-zero-transmissions",
  title: "Phase Zero Transmissions",
  href: "/releases/phase-zero-transmissions",
};

function item(
  index: number,
  slug: string,
  title: string,
  mediaKind: MediaKind,
  mediaSrc: string | null,
  mimeType: string | null,
  artworkSrc: string,
): CatalogueItem {
  const base = {
    id: `30000000-0000-4000-8000-${String(100 + index).padStart(12, "0")}`,
    slug,
    creator: artist,
    release,
    href: `/tracks/${release.slug}/${slug}`,
    artwork: {
      src: artworkSrc,
      alt: `${title} artwork.`,
    },
    description: {
      title,
      subtitle: `${release.title} · ${artist.name}`,
    },
  };

  return mediaKind === "audio"
    ? {
        ...base,
        mediaKind,
        media:
          mediaSrc && mimeType
            ? { src: mediaSrc, mimeType: mimeType as `audio/${string}` }
            : undefined,
      }
    : {
        ...base,
        mediaKind,
        media:
          mediaSrc && mimeType
            ? { src: mediaSrc, mimeType: mimeType as `video/${string}` }
            : undefined,
      };
}

const discovery = [
  {
    genre: "electronic",
    moods: ["provocative", "energetic"],
    year: 2026,
    creativeProcessTags: ["ai-generation", "human-editing"],
  },
  {
    genre: "electronic",
    moods: ["defiant", "energetic"],
    year: 2026,
    creativeProcessTags: ["ai-vocals", "human-production"],
  },
  {
    genre: "experimental",
    moods: ["surreal", "cinematic"],
    year: 2026,
    creativeProcessTags: ["ai-video", "human-direction"],
  },
  {
    genre: "folk",
    moods: ["playful", "earthy"],
    year: 2026,
    creativeProcessTags: ["ai-lyrics", "human-performance"],
  },
  {
    genre: "ambient",
    moods: ["calm", "reflective"],
    year: 2026,
    creativeProcessTags: ["ai-texture", "human-production"],
  },
  {
    genre: "ambient",
    moods: ["calm"],
    year: 2026,
    creativeProcessTags: ["human-production"],
  },
];

const items = [
  item(
    1,
    "ai-pop-slop-202607190035",
    "AI Pop-Slop 202607190035",
    "video",
    "/assets/video/AI_pop-slop_202607190035.mp4",
    "video/mp4",
    "/assets/thumbs/thumb-01.svg",
  ),
  item(
    2,
    "revolution-will-be-televised",
    "Sunstruck Synapse (Revolution will be televised)",
    "audio",
    "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
    "audio/mpeg",
    "/assets/thumbs/thumb-02.svg",
  ),
  item(
    3,
    "final-movie-00007",
    "Final Movie 00007",
    "video",
    "/assets/video/final-movie_00007_.mp4",
    "video/mp4",
    "/assets/thumbs/thumb-03.svg",
  ),
  item(
    4,
    "the-mushroom-circle-gnome-revolution",
    "The Mushroom Circle (Gnome Revolution)",
    "audio",
    "/assets/audio/The Mushroom Circle (Gnome Revolution).mp3",
    "audio/mpeg",
    "/assets/thumbs/thumb-05.svg",
  ),
  item(
    5,
    "gone-fishing",
    "Gone Fishing",
    "video",
    "/assets/video/gone_fishing.mp4",
    "video/mp4",
    "/assets/thumbs/thumb-09.svg",
  ),
  item(6, "quiet-machines", "Quiet Machines", "audio", null, null, "/assets/thumbs/thumb-06.svg"),
].map((catalogueItem, index) => ({ ...catalogueItem, discovery: discovery[index] }));

export function createE2eCatalogueRepository() {
  const disclosures: Record<string, PublicTrackDisclosure> = {
    [items[1].id]: {
      trackTitle: items[1].description.title,
      releaseTitle: release.title,
      artistName: artist.name,
      reviewedAt: "2026-08-16T09:00:00.000Z",
      rights: {
        authorityBasis: "original_author",
        publicSummary: "Original-author submission accepted for curator preparation.",
        publicNotes: "Rights-cleared for Sunstruck Synapse Radio.",
        territories: ["Worldwide"],
        distributorName: "Independent",
        distributorReleaseId: "SSR-PHASE-0",
        isrc: "GBABC2600001",
      },
      process: {
        aiUsed: true,
        aiUseDescription: "AI-assisted ideation.",
        meaningfulHumanContribution: "Human composition, editing, and final production.",
        publicSummary: "AI supported ideation while humans directed the final work.",
        humanRoles: [
          {
            name: "Sunstruck Synapse",
            role: "artist",
            contribution: "Composition and production",
            isPublic: true,
          },
        ],
        aiTools: [
          {
            name: "Fictional Sketch Model",
            model: "v1",
            provider: "Example",
            purpose: "Ideation",
            isPublic: true,
          },
        ],
        lyricsUsed: false,
        lyricsDetails: null,
        voiceCloneUsed: false,
        voiceCloneDetails: null,
        samplesUsed: false,
        sampleDetails: null,
        sourceMaterialContext: null,
      },
      provenance: {
        summary: "Reviewed provenance summary.",
        publicNotes: "Public notes exclude evidence object references.",
        sources: [
          {
            sourceType: "generated_material",
            reference: "Seed sketch 001",
            rightsContext: "Internal development sketch.",
          },
        ],
        steps: [
          {
            position: 1,
            processType: "arrangement",
            description: "The artist rebuilt the arrangement from the sketch.",
            occurredAt: null,
          },
        ],
      },
    },
  };
  return createStaticCatalogueRepository(
    items,
    [
      {
        id: "60000000-0000-4000-8000-000000000101",
        slug: "latest-transmissions",
        name: "Latest transmissions",
        description: "The newest published transmissions selected for the radio.",
        items: items.slice(0, 4),
      },
      {
        id: "60000000-0000-4000-8000-000000000102",
        slug: "listen",
        name: "Listen",
        description: "Published audio transmissions.",
        items: items.filter((entry) => entry.mediaKind === "audio"),
      },
      {
        id: "60000000-0000-4000-8000-000000000103",
        slug: "watch",
        name: "Watch",
        description: "Published audiovisual transmissions.",
        items: items.filter((entry) => entry.mediaKind === "video"),
      },
    ],
    disclosures,
  );
}
