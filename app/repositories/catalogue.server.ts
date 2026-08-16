import { and, asc, eq, or, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";

import {
  artistArtworkAssets,
  artists,
  artworkAssets,
  audioAssets,
  collectionItems,
  creativeProcessDisclosures,
  editorialCollections,
  provenanceRecords,
  provenanceSources,
  provenanceSteps,
  releaseArtistCredits,
  releaseArtworkAssets,
  releases,
  rightsDeclarations,
  submissions,
  trackArtistCredits,
  trackArtworkAssets,
  tracks,
  videoAssets,
} from "../db/schema";
import * as schema from "../db/schema";
import type {
  Artwork,
  CatalogueItem,
  CatalogueLoadResult,
  PublicArtist,
  PublicEditorialCollection,
  PublicRelease,
  PublicTrack,
} from "../types/catalogue";
import type { PublicTrackDisclosure } from "../types/submissions";
import { createMediaDeliveryUrl } from "../services/media-signing";

export interface CatalogueRepository {
  listPublishedTracks(): Promise<CatalogueItem[]>;
  listPublishedCollections(publishedItems?: CatalogueItem[]): Promise<PublicEditorialCollection[]>;
  findPublishedCollection(slug: string): Promise<PublicEditorialCollection | null>;
  findPublishedArtist(slug: string): Promise<PublicArtist | null>;
  findPublishedRelease(slug: string): Promise<PublicRelease | null>;
  findPublishedTrack(releaseSlug: string, trackSlug: string): Promise<PublicTrack | null>;
  findPublicTrackDisclosure(
    releaseSlug: string,
    trackSlug: string,
  ): Promise<PublicTrackDisclosure | null>;
}

interface PublishedTrackRow {
  trackId: string;
  trackSlug: string;
  trackTitle: string;
  trackPosition: number;
  releaseId: string;
  releaseSlug: string;
  releaseTitle: string;
  releaseDate: Date | null;
  artistId: string;
  artistSlug: string;
  artistName: string;
  artistBiography: string | null;
  artistPosition: number;
  artworkObjectKey: string | null;
  artworkAssetId: string | null;
  artworkStorageProvider: "static" | "r2" | null;
  artworkAltText: string | null;
  audioObjectKey: string | null;
  audioAssetId: string | null;
  audioStorageProvider: "static" | "r2" | null;
  audioMimeType: string | null;
  videoObjectKey: string | null;
  videoMimeType: string | null;
}

function publicAssetPath(objectKey: string): string {
  return `/${objectKey.replace(/^\/+/, "")}`;
}

function artworkForRow(row: PublishedTrackRow): Artwork {
  return {
    src: row.artworkObjectKey ? publicAssetPath(row.artworkObjectKey) : "/assets/favicon.svg",
    alt: row.artworkAltText ?? `Artwork for ${row.releaseTitle}`,
  };
}

export function mapPublishedTracks(rows: PublishedTrackRow[]): CatalogueItem[] {
  const items = new Map<string, CatalogueItem>();

  for (const row of rows) {
    if (items.has(row.trackId)) {
      continue;
    }

    const artwork = artworkForRow(row);
    const mediaKind = row.videoObjectKey ? "video" : "audio";
    const mediaObjectKey = mediaKind === "video" ? row.videoObjectKey : row.audioObjectKey;
    const mediaMimeType = mediaKind === "video" ? row.videoMimeType : row.audioMimeType;
    const media =
      mediaObjectKey && mediaMimeType
        ? {
            src: publicAssetPath(mediaObjectKey),
            mimeType: mediaMimeType,
          }
        : undefined;
    const creator = {
      id: row.artistId,
      slug: row.artistSlug,
      name: row.artistName,
      role: "Artist",
      href: `/artists/${row.artistSlug}`,
    };
    const release = {
      id: row.releaseId,
      slug: row.releaseSlug,
      title: row.releaseTitle,
      href: `/releases/${row.releaseSlug}`,
    };
    const base = {
      id: row.trackId,
      slug: row.trackSlug,
      creator,
      release,
      href: `/tracks/${row.releaseSlug}/${row.trackSlug}`,
      artwork,
      description: {
        title: row.trackTitle,
        subtitle: `${row.releaseTitle} · ${row.artistName}`,
      },
    };

    items.set(
      row.trackId,
      mediaKind === "video"
        ? {
            ...base,
            mediaKind,
            media: media
              ? {
                  src: media.src,
                  mimeType: media.mimeType as `video/${string}`,
                }
              : undefined,
          }
        : {
            ...base,
            mediaKind,
            media: media
              ? {
                  src: media.src,
                  mimeType: media.mimeType as `audio/${string}`,
                }
              : undefined,
          },
    );
  }

  return [...items.values()];
}

function artistFromItems(items: CatalogueItem[], slug: string): PublicArtist | null {
  const tracksForArtist = items.filter((item) => item.creator.slug === slug);
  const first = tracksForArtist[0];
  if (!first) {
    return null;
  }

  return {
    id: first.creator.id,
    slug,
    name: first.creator.name,
    biography: null,
    href: first.creator.href,
    artwork: first.artwork,
    tracks: tracksForArtist,
  };
}

function releaseFromItems(
  items: CatalogueItem[],
  slug: string,
  releaseDate: string | null = null,
): PublicRelease | null {
  const releaseTracks = items.filter((item) => item.release.slug === slug);
  const first = releaseTracks[0];
  if (!first) {
    return null;
  }

  const artistsById = new Map(releaseTracks.map((item) => [item.creator.id, item.creator]));
  return {
    id: first.release.id,
    slug,
    title: first.release.title,
    releaseDate,
    href: first.release.href,
    artwork: first.artwork,
    artists: [...artistsById.values()],
    tracks: releaseTracks,
  };
}

export function createStaticCatalogueRepository(
  items: CatalogueItem[],
  collections: PublicEditorialCollection[] = [],
  disclosures: Record<string, PublicTrackDisclosure> = {},
): CatalogueRepository {
  return {
    async listPublishedTracks() {
      return items;
    },
    async listPublishedCollections() {
      return collections;
    },
    async findPublishedCollection(slug) {
      return collections.find((collection) => collection.slug === slug) ?? null;
    },
    async findPublishedArtist(slug) {
      return artistFromItems(items, slug);
    },
    async findPublishedRelease(slug) {
      return releaseFromItems(items, slug);
    },
    async findPublishedTrack(releaseSlug, trackSlug) {
      const item =
        items.find(
          (candidate) => candidate.release.slug === releaseSlug && candidate.slug === trackSlug,
        ) ?? null;
      if (!item) {
        return null;
      }

      const artist = artistFromItems(items, item.creator.slug);
      const release = releaseFromItems(items, item.release.slug);
      if (!artist || !release) {
        return null;
      }
      return {
        item,
        artist,
        release,
        reviewedDisclosureHref: disclosures[item.id] ? `${item.href}/disclosure` : undefined,
      };
    },
    async findPublicTrackDisclosure(releaseSlug, trackSlug) {
      const item =
        items.find(
          (candidate) => candidate.release.slug === releaseSlug && candidate.slug === trackSlug,
        ) ?? null;
      return item ? (disclosures[item.id] ?? null) : null;
    },
  };
}

export function createCatalogueRepository<TQueryResult extends PgQueryResultHKT>(
  db: PgDatabase<TQueryResult, typeof schema>,
  media?: { signingSecret: string },
): CatalogueRepository {
  async function readPublishedRows(): Promise<PublishedTrackRow[]> {
    const rows = await db
      .select({
        trackId: tracks.id,
        trackSlug: tracks.slug,
        trackTitle: tracks.title,
        trackPosition: tracks.position,
        releaseId: releases.id,
        releaseSlug: releases.slug,
        releaseTitle: releases.title,
        releaseDate: releases.releaseDate,
        artistId: artists.id,
        artistSlug: artists.slug,
        artistName: artists.displayName,
        artistBiography: artists.biography,
        artistPosition: trackArtistCredits.position,
        artworkObjectKey: artworkAssets.objectKey,
        artworkAssetId: artworkAssets.id,
        artworkStorageProvider: artworkAssets.storageProvider,
        artworkAltText: trackArtworkAssets.altText,
        audioObjectKey: audioAssets.objectKey,
        audioAssetId: audioAssets.id,
        audioStorageProvider: audioAssets.storageProvider,
        audioMimeType: audioAssets.mimeType,
        videoObjectKey: videoAssets.objectKey,
        videoMimeType: videoAssets.mimeType,
      })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(trackArtistCredits, eq(trackArtistCredits.trackId, tracks.id))
      .innerJoin(artists, eq(artists.id, trackArtistCredits.artistId))
      .leftJoin(
        trackArtworkAssets,
        and(
          eq(trackArtworkAssets.trackId, tracks.id),
          eq(trackArtworkAssets.role, "primary"),
          eq(trackArtworkAssets.position, 1),
        ),
      )
      .leftJoin(
        artworkAssets,
        and(
          eq(artworkAssets.id, trackArtworkAssets.artworkAssetId),
          eq(artworkAssets.scope, "publishable_derivative"),
          eq(artworkAssets.status, "ready"),
        ),
      )
      .leftJoin(
        audioAssets,
        and(
          eq(audioAssets.trackId, tracks.id),
          eq(audioAssets.scope, "publishable_derivative"),
          eq(audioAssets.isPrimary, true),
          eq(audioAssets.status, "ready"),
        ),
      )
      .leftJoin(
        videoAssets,
        and(
          eq(videoAssets.trackId, tracks.id),
          eq(videoAssets.scope, "publishable_derivative"),
          eq(videoAssets.isPrimary, true),
          eq(videoAssets.status, "ready"),
        ),
      )
      .where(
        and(
          eq(artists.lifecycleStatus, "published"),
          eq(releases.lifecycleStatus, "published"),
          eq(tracks.lifecycleStatus, "published"),
        ),
      )
      .orderBy(
        sql`${releases.releaseDate} desc nulls last`,
        asc(releases.slug),
        asc(tracks.discNumber),
        asc(tracks.position),
        asc(trackArtistCredits.position),
      );
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        artworkObjectKey:
          row.artworkStorageProvider === "r2"
            ? row.artworkAssetId && media
              ? await createMediaDeliveryUrl("", "artwork", row.artworkAssetId, media.signingSecret)
              : null
            : row.artworkObjectKey,
        audioObjectKey:
          row.audioStorageProvider === "r2"
            ? row.audioAssetId
              ? `/media/audio/${row.audioAssetId}`
              : null
            : row.audioObjectKey,
      })),
    );
  }

  async function listPublishedTracks() {
    return mapPublishedTracks(await readPublishedRows());
  }

  async function artworkPath(
    id: string | null,
    objectKey: string | null,
    provider: "static" | "r2" | null,
  ): Promise<string | null> {
    if (provider !== "r2") return objectKey ? publicAssetPath(objectKey) : null;
    return id && media ? createMediaDeliveryUrl("", "artwork", id, media.signingSecret) : null;
  }

  async function listPublishedCollections(
    publishedItems?: CatalogueItem[],
  ): Promise<PublicEditorialCollection[]> {
    const items = publishedItems ?? (await listPublishedTracks());
    const rows = await db
      .select({
        collectionId: editorialCollections.id,
        collectionSlug: editorialCollections.slug,
        collectionName: editorialCollections.name,
        collectionDescription: editorialCollections.description,
        artworkAssetId: artworkAssets.id,
        artworkObjectKey: artworkAssets.objectKey,
        artworkStorageProvider: artworkAssets.storageProvider,
        position: collectionItems.position,
        trackId: collectionItems.trackId,
        releaseId: collectionItems.releaseId,
      })
      .from(editorialCollections)
      .leftJoin(
        artworkAssets,
        and(
          eq(artworkAssets.id, editorialCollections.artworkAssetId),
          eq(artworkAssets.scope, "publishable_derivative"),
          eq(artworkAssets.status, "ready"),
        ),
      )
      .innerJoin(collectionItems, eq(collectionItems.collectionId, editorialCollections.id))
      .where(
        and(
          eq(editorialCollections.lifecycleStatus, "published"),
          eq(editorialCollections.showOnHomepage, true),
        ),
      )
      .orderBy(
        asc(editorialCollections.homepagePosition),
        asc(editorialCollections.slug),
        asc(collectionItems.position),
      );
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const collections = new Map<
      string,
      PublicEditorialCollection & {
        artworkAssetId: string | null;
        artworkObjectKey: string | null;
        artworkStorageProvider: "static" | "r2" | null;
      }
    >();

    for (const row of rows) {
      const collection = collections.get(row.collectionId) ?? {
        id: row.collectionId,
        slug: row.collectionSlug,
        name: row.collectionName,
        description: row.collectionDescription,
        artworkAssetId: row.artworkAssetId,
        artworkObjectKey: row.artworkObjectKey,
        artworkStorageProvider: row.artworkStorageProvider,
        items: [],
      };
      const targetItems = row.trackId
        ? [itemsById.get(row.trackId)].filter((item): item is CatalogueItem => Boolean(item))
        : items.filter((item) => item.release.id === row.releaseId);
      for (const item of targetItems) {
        if (!collection.items.some((candidate) => candidate.id === item.id)) {
          collection.items.push(item);
        }
      }
      collections.set(row.collectionId, collection);
    }

    const result = await Promise.all(
      [...collections.values()]
        .filter((collection) => collection.items.length > 0)
        .map(async (collection) => {
          const artworkSrc = await artworkPath(
            collection.artworkAssetId,
            collection.artworkObjectKey,
            collection.artworkStorageProvider,
          );
          return {
            id: collection.id,
            slug: collection.slug,
            name: collection.name,
            description: collection.description,
            artwork: artworkSrc
              ? {
                  src: artworkSrc,
                  alt: `${collection.name} artwork`,
                }
              : undefined,
            items: collection.items,
          };
        }),
    );

    return result;
  }

  async function findPublicTrackDisclosure(
    releaseSlug: string,
    trackSlug: string,
  ): Promise<PublicTrackDisclosure | null> {
    const [row] = await db
      .select({
        trackTitle: tracks.title,
        releaseTitle: releases.title,
        artistName: artists.displayName,
        reviewedAt: submissions.acceptedAt,
        authorityBasis: rightsDeclarations.authorityBasis,
        rightsPublicSummary: rightsDeclarations.publicSummary,
        rightsPublicNotes: rightsDeclarations.publicNotes,
        territories: rightsDeclarations.territories,
        distributorName: rightsDeclarations.distributorName,
        distributorReleaseId: rightsDeclarations.distributorReleaseId,
        isrc: rightsDeclarations.isrc,
        aiUsed: creativeProcessDisclosures.aiUsed,
        aiUseDescription: creativeProcessDisclosures.aiUseDescription,
        meaningfulHumanContribution: creativeProcessDisclosures.meaningfulHumanContribution,
        processSummary: creativeProcessDisclosures.artistSummary,
        humanRoles: creativeProcessDisclosures.humanRoles,
        aiTools: creativeProcessDisclosures.aiTools,
        lyricsUsed: creativeProcessDisclosures.lyricsUsed,
        lyricsDetails: creativeProcessDisclosures.lyricsDetails,
        voiceCloneUsed: creativeProcessDisclosures.voiceCloneUsed,
        voiceCloneDetails: creativeProcessDisclosures.voiceCloneDetails,
        samplesUsed: creativeProcessDisclosures.samplesUsed,
        sampleDetails: creativeProcessDisclosures.sampleDetails,
        sourceMaterialContext: creativeProcessDisclosures.sourceMaterialContext,
        provenanceSummary: provenanceRecords.summary,
        provenancePublicNotes: provenanceRecords.publicNotes,
        provenanceRecordId: provenanceRecords.id,
      })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(trackArtistCredits, eq(trackArtistCredits.trackId, tracks.id))
      .innerJoin(artists, eq(artists.id, trackArtistCredits.artistId))
      .innerJoin(
        submissions,
        and(
          eq(submissions.status, "accepted"),
          or(
            eq(submissions.resultingTrackId, tracks.id),
            eq(submissions.resultingReleaseId, releases.id),
          ),
        ),
      )
      .innerJoin(
        rightsDeclarations,
        eq(rightsDeclarations.id, submissions.acceptedRightsDeclarationId),
      )
      .innerJoin(
        creativeProcessDisclosures,
        eq(creativeProcessDisclosures.id, submissions.acceptedCreativeProcessDisclosureId),
      )
      .innerJoin(
        provenanceRecords,
        eq(provenanceRecords.id, submissions.acceptedProvenanceRecordId),
      )
      .where(
        and(
          eq(releases.slug, releaseSlug),
          eq(tracks.slug, trackSlug),
          eq(releases.lifecycleStatus, "published"),
          eq(tracks.lifecycleStatus, "published"),
          eq(trackArtistCredits.position, 1),
        ),
      )
      .limit(1);
    if (!row || !row.reviewedAt) return null;
    const [steps, sources] = await Promise.all([
      db
        .select({
          position: provenanceSteps.position,
          processType: provenanceSteps.processType,
          description: provenanceSteps.description,
          occurredAt: provenanceSteps.occurredAt,
        })
        .from(provenanceSteps)
        .where(eq(provenanceSteps.provenanceRecordId, row.provenanceRecordId))
        .orderBy(asc(provenanceSteps.position)),
      db
        .select({
          sourceType: provenanceSources.sourceType,
          reference: provenanceSources.reference,
          rightsContext: provenanceSources.rightsContext,
        })
        .from(provenanceSources)
        .where(eq(provenanceSources.provenanceRecordId, row.provenanceRecordId))
        .orderBy(asc(provenanceSources.position)),
    ]);
    return {
      trackTitle: row.trackTitle,
      releaseTitle: row.releaseTitle,
      artistName: row.artistName,
      reviewedAt: row.reviewedAt.toISOString(),
      rights: {
        authorityBasis:
          row.authorityBasis === "licensed" || row.authorityBasis === "public_domain"
            ? row.authorityBasis
            : "original_author",
        publicSummary: row.rightsPublicSummary,
        publicNotes: row.rightsPublicNotes,
        territories: row.territories,
        distributorName: row.distributorName,
        distributorReleaseId: row.distributorReleaseId,
        isrc: row.isrc,
      },
      process: {
        aiUsed: row.aiUsed,
        aiUseDescription: row.aiUseDescription,
        meaningfulHumanContribution: row.meaningfulHumanContribution,
        publicSummary: row.processSummary,
        humanRoles: row.humanRoles,
        aiTools: row.aiTools,
        lyricsUsed: row.lyricsUsed,
        lyricsDetails: row.lyricsDetails,
        voiceCloneUsed: row.voiceCloneUsed,
        voiceCloneDetails: row.voiceCloneDetails,
        samplesUsed: row.samplesUsed,
        sampleDetails: row.sampleDetails,
        sourceMaterialContext: row.sourceMaterialContext,
      },
      provenance: {
        summary: row.provenanceSummary,
        publicNotes: row.provenancePublicNotes,
        steps: steps.map((step) => ({
          position: step.position,
          processType: step.processType,
          description: step.description,
          occurredAt: step.occurredAt?.toISOString() ?? null,
        })),
        sources,
      },
    };
  }

  return {
    listPublishedTracks,
    listPublishedCollections,
    async findPublishedCollection(slug) {
      const allItems = await listPublishedTracks();
      const [collection] = await db
        .select({
          id: editorialCollections.id,
          slug: editorialCollections.slug,
          name: editorialCollections.name,
          description: editorialCollections.description,
          artworkAssetId: artworkAssets.id,
          artworkObjectKey: artworkAssets.objectKey,
          artworkStorageProvider: artworkAssets.storageProvider,
        })
        .from(editorialCollections)
        .leftJoin(
          artworkAssets,
          and(
            eq(artworkAssets.id, editorialCollections.artworkAssetId),
            eq(artworkAssets.scope, "publishable_derivative"),
            eq(artworkAssets.status, "ready"),
          ),
        )
        .where(
          and(
            eq(editorialCollections.slug, slug),
            eq(editorialCollections.lifecycleStatus, "published"),
          ),
        )
        .limit(1);
      if (!collection) return null;
      const rows = await db
        .select({
          position: collectionItems.position,
          trackId: collectionItems.trackId,
          releaseId: collectionItems.releaseId,
        })
        .from(collectionItems)
        .where(eq(collectionItems.collectionId, collection.id))
        .orderBy(asc(collectionItems.position), asc(collectionItems.id));
      const itemsById = new Map(allItems.map((item) => [item.id, item]));
      const selected: CatalogueItem[] = [];
      for (const row of rows) {
        const candidates = row.trackId
          ? [itemsById.get(row.trackId)].filter((item): item is CatalogueItem => Boolean(item))
          : allItems.filter((item) => item.release.id === row.releaseId);
        for (const item of candidates) {
          if (!selected.some(({ id }) => id === item.id)) selected.push(item);
        }
      }
      const artworkSrc = await artworkPath(
        collection.artworkAssetId,
        collection.artworkObjectKey,
        collection.artworkStorageProvider,
      );
      return {
        id: collection.id,
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
        artwork: artworkSrc
          ? {
              src: artworkSrc,
              alt: `${collection.name} artwork`,
            }
          : undefined,
        items: selected,
      };
    },
    async findPublishedArtist(slug) {
      const [artist] = await db
        .select({
          id: artists.id,
          slug: artists.slug,
          name: artists.displayName,
          biography: artists.biography,
          artworkAssetId: artworkAssets.id,
          artworkObjectKey: artworkAssets.objectKey,
          artworkStorageProvider: artworkAssets.storageProvider,
          artworkAltText: artistArtworkAssets.altText,
        })
        .from(artists)
        .leftJoin(
          artistArtworkAssets,
          and(
            eq(artistArtworkAssets.artistId, artists.id),
            eq(artistArtworkAssets.role, "avatar"),
            eq(artistArtworkAssets.position, 1),
          ),
        )
        .leftJoin(
          artworkAssets,
          and(
            eq(artworkAssets.id, artistArtworkAssets.artworkAssetId),
            eq(artworkAssets.scope, "publishable_derivative"),
            eq(artworkAssets.status, "ready"),
          ),
        )
        .where(and(eq(artists.slug, slug), eq(artists.lifecycleStatus, "published")))
        .limit(1);
      if (!artist) {
        return null;
      }

      const [items, creditedTracks] = await Promise.all([
        listPublishedTracks(),
        db
          .select({ trackId: trackArtistCredits.trackId })
          .from(trackArtistCredits)
          .where(eq(trackArtistCredits.artistId, artist.id)),
      ]);
      const artworkSrc = await artworkPath(
        artist.artworkAssetId,
        artist.artworkObjectKey,
        artist.artworkStorageProvider,
      );
      const creditedTrackIds = new Set(creditedTracks.map(({ trackId }) => trackId));
      return {
        id: artist.id,
        slug: artist.slug,
        name: artist.name,
        biography: artist.biography,
        href: `/artists/${artist.slug}`,
        artwork: {
          src: artworkSrc ?? "/assets/favicon.svg",
          alt: artist.artworkAltText ?? `${artist.name} artwork`,
        },
        tracks: items.filter((item) => creditedTrackIds.has(item.id)),
      };
    },
    async findPublishedRelease(slug) {
      const releaseRows = await db
        .select({
          id: releases.id,
          slug: releases.slug,
          title: releases.title,
          releaseDate: releases.releaseDate,
          artworkAssetId: artworkAssets.id,
          artworkObjectKey: artworkAssets.objectKey,
          artworkStorageProvider: artworkAssets.storageProvider,
          artworkAltText: releaseArtworkAssets.altText,
          artistId: artists.id,
          artistSlug: artists.slug,
          artistName: artists.displayName,
          creditedAs: releaseArtistCredits.creditedAs,
        })
        .from(releases)
        .innerJoin(releaseArtistCredits, eq(releaseArtistCredits.releaseId, releases.id))
        .innerJoin(artists, eq(artists.id, releaseArtistCredits.artistId))
        .leftJoin(
          releaseArtworkAssets,
          and(
            eq(releaseArtworkAssets.releaseId, releases.id),
            eq(releaseArtworkAssets.role, "primary"),
            eq(releaseArtworkAssets.position, 1),
          ),
        )
        .leftJoin(
          artworkAssets,
          and(
            eq(artworkAssets.id, releaseArtworkAssets.artworkAssetId),
            eq(artworkAssets.scope, "publishable_derivative"),
            eq(artworkAssets.status, "ready"),
          ),
        )
        .where(
          and(
            eq(releases.slug, slug),
            eq(releases.lifecycleStatus, "published"),
            eq(artists.lifecycleStatus, "published"),
          ),
        )
        .orderBy(asc(releaseArtistCredits.position));
      const release = releaseRows[0];
      if (!release) {
        return null;
      }

      const items = mapPublishedTracks(await readPublishedRows()).filter(
        (item) => item.release.id === release.id,
      );
      const artworkSrc = await artworkPath(
        release.artworkAssetId,
        release.artworkObjectKey,
        release.artworkStorageProvider,
      );
      return {
        id: release.id,
        slug: release.slug,
        title: release.title,
        releaseDate: release.releaseDate?.toISOString() ?? null,
        href: `/releases/${release.slug}`,
        artwork: {
          src: artworkSrc ?? "/assets/favicon.svg",
          alt: release.artworkAltText ?? `Artwork for ${release.title}`,
        },
        artists: releaseRows.map((row) => ({
          id: row.artistId,
          slug: row.artistSlug,
          name: row.creditedAs ?? row.artistName,
          role: "Artist",
          href: `/artists/${row.artistSlug}`,
        })),
        tracks: items,
      };
    },
    async findPublishedTrack(releaseSlug, trackSlug) {
      const rows = await readPublishedRows();
      const items = mapPublishedTracks(rows);
      const item =
        items.find(
          (candidate) => candidate.release.slug === releaseSlug && candidate.slug === trackSlug,
        ) ?? null;
      if (!item) {
        return null;
      }

      const artist = artistFromItems(items, item.creator.slug);
      const releaseDate =
        rows.find((row) => row.releaseSlug === releaseSlug)?.releaseDate?.toISOString() ?? null;
      const release = releaseFromItems(items, releaseSlug, releaseDate);
      if (!artist || !release) {
        return null;
      }
      const disclosure = await findPublicTrackDisclosure(releaseSlug, trackSlug);
      return {
        item,
        artist,
        release,
        reviewedDisclosureHref: disclosure ? `${item.href}/disclosure` : undefined,
      };
    },
    async findPublicTrackDisclosure(releaseSlug, trackSlug) {
      return findPublicTrackDisclosure(releaseSlug, trackSlug);
    },
  };
}

export async function loadPublicCatalogue(
  repository: CatalogueRepository,
): Promise<CatalogueLoadResult> {
  try {
    const items = await repository.listPublishedTracks();
    const collections = await repository.listPublishedCollections(items);
    return items.length > 0
      ? { status: "ready", items, collections }
      : { status: "empty", items: [], collections: [] };
  } catch (error) {
    console.error("Public catalogue query failed.", error);
    return {
      status: "error",
      items: [],
      collections: [],
      message: "The catalogue is temporarily unavailable. Please try again shortly.",
    };
  }
}
