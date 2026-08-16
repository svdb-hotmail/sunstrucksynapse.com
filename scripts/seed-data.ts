import { and, eq } from "drizzle-orm";
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
  provenanceEvidence,
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
} from "../app/db/schema";
import * as schema from "../app/db/schema";

export const seedIds = {
  artist: "10000000-0000-4000-8000-000000000001",
  release: "20000000-0000-4000-8000-000000000001",
  trackOne: "30000000-0000-4000-8000-000000000001",
  trackTwo: "30000000-0000-4000-8000-000000000002",
  artwork: "40000000-0000-4000-8000-000000000001",
  masterAudio: "50000000-0000-4000-8000-000000000001",
  derivativeAudio: "50000000-0000-4000-8000-000000000002",
  collection: "60000000-0000-4000-8000-000000000001",
  collectionRelease: "61000000-0000-4000-8000-000000000001",
  collectionTrack: "61000000-0000-4000-8000-000000000002",
  submission: "70000000-0000-4000-8000-000000000001",
  rightsOne: "80000000-0000-4000-8000-000000000001",
  rightsTwo: "80000000-0000-4000-8000-000000000002",
  disclosureOne: "90000000-0000-4000-8000-000000000001",
  disclosureTwo: "90000000-0000-4000-8000-000000000002",
  provenanceOne: "a0000000-0000-4000-8000-000000000001",
  provenanceTwo: "a0000000-0000-4000-8000-000000000002",
  provenanceStep: "a1000000-0000-4000-8000-000000000001",
  provenanceSource: "a2000000-0000-4000-8000-000000000001",
  provenanceEvidence: "a3000000-0000-4000-8000-000000000001",
  productionArtist: "10000000-0000-4000-8000-000000000101",
  productionRelease: "20000000-0000-4000-8000-000000000101",
  productionTracks: [
    "30000000-0000-4000-8000-000000000101",
    "30000000-0000-4000-8000-000000000102",
    "30000000-0000-4000-8000-000000000103",
    "30000000-0000-4000-8000-000000000104",
    "30000000-0000-4000-8000-000000000105",
  ],
  productionArtwork: [
    "40000000-0000-4000-8000-000000000101",
    "40000000-0000-4000-8000-000000000102",
    "40000000-0000-4000-8000-000000000103",
    "40000000-0000-4000-8000-000000000104",
    "40000000-0000-4000-8000-000000000105",
  ],
  productionMedia: [
    "50000000-0000-4000-8000-000000000101",
    "50000000-0000-4000-8000-000000000102",
    "50000000-0000-4000-8000-000000000103",
    "50000000-0000-4000-8000-000000000104",
    "50000000-0000-4000-8000-000000000105",
  ],
  productionPrivateMedia: "50000000-0000-4000-8000-000000000106",
  productionCollection: "60000000-0000-4000-8000-000000000101",
  productionCollectionItems: [
    "61000000-0000-4000-8000-000000000101",
    "61000000-0000-4000-8000-000000000102",
    "61000000-0000-4000-8000-000000000103",
    "61000000-0000-4000-8000-000000000104",
  ],
  productionListenCollection: "60000000-0000-4000-8000-000000000102",
  productionWatchCollection: "60000000-0000-4000-8000-000000000103",
  productionListenItems: [
    "61000000-0000-4000-8000-000000000201",
    "61000000-0000-4000-8000-000000000202",
  ],
  productionWatchItems: [
    "61000000-0000-4000-8000-000000000301",
    "61000000-0000-4000-8000-000000000302",
    "61000000-0000-4000-8000-000000000303",
  ],
  productionSubmission: "70000000-0000-4000-8000-000000000101",
  productionRights: "80000000-0000-4000-8000-000000000151",
} as const;

const publishedAt = new Date("2026-01-15T12:00:00.000Z");
const submittedAt = new Date("2026-01-10T09:00:00.000Z");
const reviewedAt = new Date("2026-01-12T15:00:00.000Z");
const acceptedAt = new Date("2026-01-13T16:00:00.000Z");
const versionOneFinalizedAt = new Date("2026-01-11T10:00:00.000Z");
const versionTwoFinalizedAt = new Date("2026-01-12T10:00:00.000Z");
const archivedAt = new Date("2026-08-16T00:00:00.000Z");

export async function seedDatabase<TQueryResult extends PgQueryResultHKT>(
  db: PgDatabase<TQueryResult, typeof schema>,
) {
  await db.transaction(async (tx) => {
    await tx
      .insert(artworkAssets)
      .values({
        id: seedIds.artwork,
        objectKey: "artwork/catalogue/synthetic-dawn-cover.webp",
        scope: "publishable_derivative",
        mimeType: "image/webp",
        checksumSha256: "1".repeat(64),
        byteSize: 245_760,
        width: 1600,
        height: 1600,
      })
      .onConflictDoNothing();

    await tx
      .insert(artists)
      .values({
        id: seedIds.artist,
        slug: "synthetic-dawn-ensemble",
        displayName: "Synthetic Dawn Ensemble",
        biography: "A fictional artist used only for deterministic development data.",
        lifecycleStatus: "published",
        publishedAt,
      })
      .onConflictDoNothing();

    await tx
      .insert(artistArtworkAssets)
      .values({
        artistId: seedIds.artist,
        artworkAssetId: seedIds.artwork,
        role: "avatar",
        position: 1,
        altText: "Abstract sunrise artwork for the fictional Synthetic Dawn Ensemble.",
      })
      .onConflictDoNothing();

    await tx
      .insert(releases)
      .values({
        id: seedIds.release,
        slug: "signals-before-sunrise",
        title: "Signals Before Sunrise",
        releaseDate: publishedAt,
        lifecycleStatus: "published",
        publishedAt,
      })
      .onConflictDoNothing();

    await tx
      .insert(releaseArtistCredits)
      .values({
        releaseId: seedIds.release,
        artistId: seedIds.artist,
        position: 1,
        creditedAs: "Synthetic Dawn Ensemble",
      })
      .onConflictDoNothing();

    await tx
      .insert(releaseArtworkAssets)
      .values({
        releaseId: seedIds.release,
        artworkAssetId: seedIds.artwork,
        role: "primary",
        position: 1,
        altText: "Cover artwork for Signals Before Sunrise.",
      })
      .onConflictDoNothing();

    await tx
      .insert(tracks)
      .values([
        {
          id: seedIds.trackOne,
          releaseId: seedIds.release,
          slug: "first-light",
          title: "First Light",
          discNumber: 1,
          position: 1,
          lifecycleStatus: "published",
          publishedAt,
        },
        {
          id: seedIds.trackTwo,
          releaseId: seedIds.release,
          slug: "quiet-circuit",
          title: "Quiet Circuit",
          discNumber: 1,
          position: 2,
          lifecycleStatus: "published",
          publishedAt,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(trackArtistCredits)
      .values([
        { trackId: seedIds.trackOne, artistId: seedIds.artist, position: 1 },
        { trackId: seedIds.trackTwo, artistId: seedIds.artist, position: 1 },
      ])
      .onConflictDoNothing();

    await tx
      .insert(audioAssets)
      .values([
        {
          id: seedIds.masterAudio,
          trackId: seedIds.trackOne,
          objectKey: "audio/private/first-light-master.wav",
          scope: "private_master",
          mimeType: "audio/wav",
          checksumSha256: "2".repeat(64),
          byteSize: 56_448_000,
          durationMs: 180_000,
          codec: "pcm_s24le",
          isPrimary: true,
        },
        {
          id: seedIds.derivativeAudio,
          trackId: seedIds.trackOne,
          objectKey: "audio/publishable/first-light-192.opus",
          scope: "publishable_derivative",
          mimeType: "audio/ogg",
          checksumSha256: "3".repeat(64),
          byteSize: 4_320_000,
          durationMs: 180_000,
          codec: "opus",
          isPrimary: true,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(artworkAssets)
      .values([
        {
          id: seedIds.productionArtwork[0],
          objectKey: "assets/thumbs/thumb-01.svg",
          scope: "publishable_derivative",
          mimeType: "image/svg+xml",
          checksumSha256: "0c8d83c6abf59b2d8e4240a92276b2996380b7d361c4366cea43d2a2198997cc",
          byteSize: 1_228,
          width: 1600,
          height: 900,
        },
        {
          id: seedIds.productionArtwork[1],
          objectKey: "assets/thumbs/thumb-02.svg",
          scope: "publishable_derivative",
          mimeType: "image/svg+xml",
          checksumSha256: "31832e5dbb572c49c9d6c17f30701a21c6163163ec864c8fbe0dc034251d6acf",
          byteSize: 1_227,
          width: 1600,
          height: 900,
        },
        {
          id: seedIds.productionArtwork[2],
          objectKey: "assets/thumbs/thumb-03.svg",
          scope: "publishable_derivative",
          mimeType: "image/svg+xml",
          checksumSha256: "ef715e70b26cc70549675184786d6e31461b1c33f870ba0b89ee1008fc9f9ec2",
          byteSize: 1_228,
          width: 1600,
          height: 900,
        },
        {
          id: seedIds.productionArtwork[3],
          objectKey: "assets/thumbs/thumb-05.svg",
          scope: "publishable_derivative",
          mimeType: "image/svg+xml",
          checksumSha256: "0401f06a033184b61b03d4c010b43db75ed9c33e573f48b0fe7954f83cea41d6",
          byteSize: 1_231,
          width: 1600,
          height: 900,
        },
        {
          id: seedIds.productionArtwork[4],
          objectKey: "assets/thumbs/thumb-09.svg",
          scope: "publishable_derivative",
          mimeType: "image/svg+xml",
          checksumSha256: "50c268e5b1d41511a10157b54797f23e46468da42d75090d66fa53f967f10877",
          byteSize: 1_229,
          width: 1600,
          height: 900,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(artists)
      .values({
        id: seedIds.productionArtist,
        slug: "sunstruck-synapse",
        displayName: "Sunstruck Synapse",
        biography:
          "Human-directed transmissions spanning electronic music and visual counterparts.",
        lifecycleStatus: "published",
        publishedAt,
      })
      .onConflictDoNothing();

    await tx
      .insert(artistArtworkAssets)
      .values({
        artistId: seedIds.productionArtist,
        artworkAssetId: seedIds.productionArtwork[0],
        role: "avatar",
        position: 1,
        altText: "Sunstruck Synapse artwork.",
      })
      .onConflictDoNothing();

    await tx
      .insert(releases)
      .values({
        id: seedIds.productionRelease,
        slug: "phase-zero-transmissions",
        title: "Phase Zero Transmissions",
        releaseDate: publishedAt,
        lifecycleStatus: "published",
        publishedAt,
      })
      .onConflictDoNothing();

    await tx
      .insert(releaseArtistCredits)
      .values({
        releaseId: seedIds.productionRelease,
        artistId: seedIds.productionArtist,
        position: 1,
        creditedAs: "Sunstruck Synapse",
      })
      .onConflictDoNothing();

    await tx
      .insert(releaseArtworkAssets)
      .values({
        releaseId: seedIds.productionRelease,
        artworkAssetId: seedIds.productionArtwork[0],
        role: "primary",
        position: 1,
        altText: "Cover artwork for Phase Zero Transmissions.",
      })
      .onConflictDoNothing();

    const productionTrackValues = [
      {
        id: seedIds.productionTracks[0],
        slug: "ai-pop-slop-202607190035",
        title: "AI Pop-Slop 202607190035",
      },
      {
        id: seedIds.productionTracks[1],
        slug: "revolution-will-be-televised",
        title: "Sunstruck Synapse (Revolution will be televised)",
      },
      {
        id: seedIds.productionTracks[2],
        slug: "final-movie-00007",
        title: "Final Movie 00007",
      },
      {
        id: seedIds.productionTracks[3],
        slug: "the-mushroom-circle-gnome-revolution",
        title: "The Mushroom Circle (Gnome Revolution)",
      },
      {
        id: seedIds.productionTracks[4],
        slug: "gone-fishing",
        title: "Gone Fishing",
      },
    ] as const;

    await tx
      .insert(tracks)
      .values(
        productionTrackValues.map((track, index) => ({
          ...track,
          releaseId: seedIds.productionRelease,
          discNumber: 1,
          position: index + 1,
          lifecycleStatus: "published" as const,
          publishedAt,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(trackArtistCredits)
      .values(
        seedIds.productionTracks.map((trackId) => ({
          trackId,
          artistId: seedIds.productionArtist,
          position: 1,
          creditedAs: "Sunstruck Synapse",
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(trackArtworkAssets)
      .values(
        seedIds.productionTracks.map((trackId, index) => ({
          trackId,
          artworkAssetId: seedIds.productionArtwork[index],
          role: "primary" as const,
          position: 1,
          altText: `${productionTrackValues[index].title} artwork.`,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(audioAssets)
      .values([
        {
          id: seedIds.productionMedia[1],
          trackId: seedIds.productionTracks[1],
          objectKey: "assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
          scope: "publishable_derivative",
          mimeType: "audio/mpeg",
          checksumSha256: "67b3e0501fb1cded733d9b6815e07dfedfbd950d32b717596b4bb31be5b5b923",
          byteSize: 7_138_735,
          durationMs: 445_289,
          codec: "mp3",
          isPrimary: true,
        },
        {
          id: seedIds.productionMedia[3],
          trackId: seedIds.productionTracks[3],
          objectKey: "assets/audio/The Mushroom Circle (Gnome Revolution).mp3",
          scope: "publishable_derivative",
          mimeType: "audio/mpeg",
          checksumSha256: "e86c3c0788f1c6067467ce0bb22156c378c298b8a3eca8ecd3dc33d783af920e",
          byteSize: 8_766_686,
          durationMs: 547_039,
          codec: "mp3",
          isPrimary: true,
        },
        {
          id: seedIds.productionPrivateMedia,
          trackId: seedIds.productionTracks[1],
          objectKey: "audio/private/revolution-master.wav",
          scope: "private_master",
          mimeType: "audio/wav",
          checksumSha256: "f".repeat(64),
          byteSize: 56_448_000,
          durationMs: 180_000,
          codec: "pcm_s24le",
          isPrimary: true,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(videoAssets)
      .values([
        {
          id: seedIds.productionMedia[0],
          trackId: seedIds.productionTracks[0],
          objectKey: "assets/video/AI_pop-slop_202607190035.mp4",
          scope: "publishable_derivative",
          mimeType: "video/mp4",
          checksumSha256: "dcbb82599d7df74fc187ca53ae908b575c0cbe1c5387747883a5157f6c0c50cf",
          byteSize: 9_613_030,
          durationMs: 30_016,
          codec: "h264-aac",
          isPrimary: true,
        },
        {
          id: seedIds.productionMedia[2],
          trackId: seedIds.productionTracks[2],
          objectKey: "assets/video/final-movie_00007_.mp4",
          scope: "publishable_derivative",
          mimeType: "video/mp4",
          checksumSha256: "fbd96fd9afda3b0a8a2c8c456477e05e04e5af5f1141deebfb7c8749878eb92c",
          byteSize: 2_249_897,
          durationMs: 14_458,
          codec: "h264-aac",
          isPrimary: true,
        },
        {
          id: seedIds.productionMedia[4],
          trackId: seedIds.productionTracks[4],
          objectKey: "assets/video/gone_fishing.mp4",
          scope: "publishable_derivative",
          mimeType: "video/mp4",
          checksumSha256: "0e85461019e5428e6f4aefe8b61b5900961acd2ee99b819354b4076e43a1fa7a",
          byteSize: 13_983_942,
          durationMs: 15_000,
          codec: "h264-aac",
          isPrimary: true,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(editorialCollections)
      .values([
        {
          id: seedIds.productionCollection,
          slug: "latest-transmissions",
          name: "Latest transmissions",
          description: "The newest published transmissions selected for the radio.",
          artworkAssetId: seedIds.productionArtwork[0],
          showOnHomepage: true,
          homepagePosition: 1,
          lifecycleStatus: "published",
          publishedAt,
        },
        {
          id: seedIds.productionListenCollection,
          slug: "listen",
          name: "Listen",
          description: "Published audio transmissions.",
          artworkAssetId: seedIds.productionArtwork[1],
          showOnHomepage: true,
          homepagePosition: 2,
          lifecycleStatus: "published",
          publishedAt,
        },
        {
          id: seedIds.productionWatchCollection,
          slug: "watch",
          name: "Watch",
          description: "Published audiovisual transmissions.",
          artworkAssetId: seedIds.productionArtwork[0],
          showOnHomepage: true,
          homepagePosition: 3,
          lifecycleStatus: "published",
          publishedAt,
        },
      ])
      .onConflictDoNothing();
    for (const [id, position] of [
      [seedIds.productionCollection, 1],
      [seedIds.productionListenCollection, 2],
      [seedIds.productionWatchCollection, 3],
    ] as const) {
      await tx
        .update(editorialCollections)
        .set({ showOnHomepage: true, homepagePosition: position })
        .where(eq(editorialCollections.id, id));
    }

    await tx
      .insert(collectionItems)
      .values(
        seedIds.productionCollectionItems.map((id, index) => ({
          id,
          collectionId: seedIds.productionCollection,
          trackId: seedIds.productionTracks[index],
          position: index + 1,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(collectionItems)
      .values([
        ...seedIds.productionListenItems.map((id, index) => ({
          id,
          collectionId: seedIds.productionListenCollection,
          trackId: seedIds.productionTracks[index === 0 ? 1 : 3],
          position: index + 1,
        })),
        ...seedIds.productionWatchItems.map((id, index) => ({
          id,
          collectionId: seedIds.productionWatchCollection,
          trackId: seedIds.productionTracks[index * 2],
          position: index + 1,
        })),
      ])
      .onConflictDoNothing();

    await tx
      .insert(submissions)
      .values({
        id: seedIds.productionSubmission,
        invitationReference: "production-catalogue-001",
        submitterName: "Sunstruck Synapse",
        submitterEmail: "rights@sunstrucksynapse.com",
        title: "Phase Zero Transmissions",
        status: "accepted",
        submittedAt,
        reviewedAt,
        acceptedAt,
        resultingReleaseId: seedIds.productionRelease,
        reviewNotes: "Rights-cleared production catalogue accepted for publication.",
      })
      .onConflictDoNothing();

    await tx
      .insert(rightsDeclarations)
      .values({
        id: seedIds.productionRights,
        submissionId: seedIds.productionSubmission,
        version: 1,
        status: "draft",
        authorityBasis: "original_author",
        containsThirdPartyMaterial: false,
        restrictions: "Approved for publication on Sunstruck Synapse Radio.",
      })
      .onConflictDoNothing();

    await tx
      .update(rightsDeclarations)
      .set({
        status: "attested",
        attestation: "The submitter confirms authority to publish all five seeded tracks.",
        attestedAt: versionOneFinalizedAt,
      })
      .where(
        and(
          eq(rightsDeclarations.id, seedIds.productionRights),
          eq(rightsDeclarations.status, "draft"),
        ),
      );

    await tx
      .insert(editorialCollections)
      .values({
        id: seedIds.collection,
        slug: "early-signals",
        name: "Early Signals",
        description: "A fictional launch collection for deterministic development data.",
        artworkAssetId: seedIds.artwork,
        showOnHomepage: false,
        lifecycleStatus: "published",
        publishedAt,
      })
      .onConflictDoNothing();
    await tx
      .update(editorialCollections)
      .set({ showOnHomepage: false, homepagePosition: null })
      .where(eq(editorialCollections.id, seedIds.collection));

    await tx
      .insert(collectionItems)
      .values([
        {
          id: seedIds.collectionRelease,
          collectionId: seedIds.collection,
          releaseId: seedIds.release,
          position: 1,
          annotation: "A complete fictional release.",
        },
        {
          id: seedIds.collectionTrack,
          collectionId: seedIds.collection,
          trackId: seedIds.trackTwo,
          position: 2,
          annotation: "A focused fictional track selection.",
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(submissions)
      .values({
        id: seedIds.submission,
        invitationReference: "seed-invitation-001",
        submitterName: "Synthetic Dawn Ensemble",
        submitterEmail: "artist@example.invalid",
        title: "Signals Before Sunrise",
        status: "accepted",
        submittedAt,
        reviewedAt,
        acceptedAt,
        resultingReleaseId: seedIds.release,
        reviewNotes: "Synthetic accepted seed submission; acceptance is separate from publication.",
      })
      .onConflictDoNothing();

    await tx
      .insert(rightsDeclarations)
      .values({
        id: seedIds.rightsOne,
        submissionId: seedIds.submission,
        version: 1,
        status: "draft",
        authorityBasis: "original_author",
        containsThirdPartyMaterial: false,
        restrictions: "Development data only.",
      })
      .onConflictDoNothing();

    await tx
      .update(rightsDeclarations)
      .set({
        status: "attested",
        attestation: "Synthetic version-one rights attestation.",
        attestedAt: versionOneFinalizedAt,
      })
      .where(
        and(eq(rightsDeclarations.id, seedIds.rightsOne), eq(rightsDeclarations.status, "draft")),
      );

    const existingRightsTwo = await tx
      .select({ id: rightsDeclarations.id })
      .from(rightsDeclarations)
      .where(eq(rightsDeclarations.id, seedIds.rightsTwo))
      .limit(1);
    if (existingRightsTwo.length === 0) {
      await tx.insert(rightsDeclarations).values({
        id: seedIds.rightsTwo,
        submissionId: seedIds.submission,
        version: 2,
        supersedesId: seedIds.rightsOne,
        status: "draft",
        authorityBasis: "original_author",
        containsThirdPartyMaterial: false,
        restrictions: "Development data only; no real-world rights are asserted.",
      });
    }

    await tx
      .update(rightsDeclarations)
      .set({
        status: "attested",
        attestation: "Synthetic version-two rights attestation.",
        attestedAt: versionTwoFinalizedAt,
      })
      .where(
        and(eq(rightsDeclarations.id, seedIds.rightsTwo), eq(rightsDeclarations.status, "draft")),
      );

    await tx
      .insert(creativeProcessDisclosures)
      .values({
        id: seedIds.disclosureOne,
        submissionId: seedIds.submission,
        version: 1,
        status: "draft",
        aiUsed: true,
        aiUseDescription: "A fictional generative sketch informed arrangement experiments.",
        meaningfulHumanContribution: "Human composition, arrangement, performance, and editing.",
        toolsAndSystems: ["Fictional Sketch Model"],
        sourceMaterialContext: "No third-party source recording was used.",
        artistSummary: "An early fictional disclosure retained for revision history.",
      })
      .onConflictDoNothing();

    await tx
      .update(creativeProcessDisclosures)
      .set({
        status: "finalized",
        finalizedAt: versionOneFinalizedAt,
      })
      .where(
        and(
          eq(creativeProcessDisclosures.id, seedIds.disclosureOne),
          eq(creativeProcessDisclosures.status, "draft"),
        ),
      );

    const existingDisclosureTwo = await tx
      .select({ id: creativeProcessDisclosures.id })
      .from(creativeProcessDisclosures)
      .where(eq(creativeProcessDisclosures.id, seedIds.disclosureTwo))
      .limit(1);
    if (existingDisclosureTwo.length === 0) {
      await tx.insert(creativeProcessDisclosures).values({
        id: seedIds.disclosureTwo,
        submissionId: seedIds.submission,
        version: 2,
        supersedesId: seedIds.disclosureOne,
        status: "draft",
        aiUsed: true,
        aiUseDescription: "A fictional generative sketch was used for ideation only.",
        meaningfulHumanContribution:
          "The artist composed, arranged, performed, selected, edited, and mixed the work.",
        toolsAndSystems: ["Fictional Sketch Model", "Digital Audio Workstation"],
        sourceMaterialContext: "No third-party source recording was used.",
        artistSummary: "AI supported ideation; the artist directed and completed the music.",
      });
    }

    await tx
      .update(creativeProcessDisclosures)
      .set({
        status: "finalized",
        finalizedAt: versionTwoFinalizedAt,
      })
      .where(
        and(
          eq(creativeProcessDisclosures.id, seedIds.disclosureTwo),
          eq(creativeProcessDisclosures.status, "draft"),
        ),
      );

    await tx
      .insert(provenanceRecords)
      .values({
        id: seedIds.provenanceOne,
        submissionId: seedIds.submission,
        version: 1,
        status: "draft",
        summary: "Initial fictional process record.",
      })
      .onConflictDoNothing();

    await tx
      .update(provenanceRecords)
      .set({
        status: "finalized",
        finalizedAt: versionOneFinalizedAt,
      })
      .where(
        and(eq(provenanceRecords.id, seedIds.provenanceOne), eq(provenanceRecords.status, "draft")),
      );

    const existingProvenanceTwo = await tx
      .select({ id: provenanceRecords.id })
      .from(provenanceRecords)
      .where(eq(provenanceRecords.id, seedIds.provenanceTwo))
      .limit(1);
    if (existingProvenanceTwo.length === 0) {
      await tx.insert(provenanceRecords).values({
        id: seedIds.provenanceTwo,
        submissionId: seedIds.submission,
        version: 2,
        supersedesId: seedIds.provenanceOne,
        status: "draft",
        summary: "Revised fictional process and source record with private evidence metadata.",
      });
      await tx.insert(provenanceSteps).values({
        id: seedIds.provenanceStep,
        provenanceRecordId: seedIds.provenanceTwo,
        position: 1,
        processType: "arrangement",
        description: "The artist selected a sketch and rebuilt the arrangement.",
      });
      await tx.insert(provenanceSources).values({
        id: seedIds.provenanceSource,
        provenanceRecordId: seedIds.provenanceTwo,
        position: 1,
        sourceType: "generated_material",
        reference: "Internal sketch reference seed-sketch-001",
        rightsContext: "Synthetic development data with no external rights claim.",
      });
      await tx.insert(provenanceEvidence).values({
        id: seedIds.provenanceEvidence,
        provenanceRecordId: seedIds.provenanceTwo,
        storageProvider: "private-r2",
        objectKey: "evidence/private/seed-sketch-001.txt",
        mimeType: "text/plain",
        checksumSha256: "4".repeat(64),
        byteSize: 512,
      });
    }

    await tx
      .update(provenanceRecords)
      .set({
        status: "finalized",
        finalizedAt: versionTwoFinalizedAt,
      })
      .where(
        and(eq(provenanceRecords.id, seedIds.provenanceTwo), eq(provenanceRecords.status, "draft")),
      );

    await tx
      .update(tracks)
      .set({ lifecycleStatus: "archived", archivedAt })
      .where(eq(tracks.releaseId, seedIds.release));
    await tx
      .update(releases)
      .set({ lifecycleStatus: "archived", archivedAt })
      .where(eq(releases.id, seedIds.release));
    await tx
      .update(artists)
      .set({ lifecycleStatus: "archived", archivedAt })
      .where(eq(artists.id, seedIds.artist));
  });
}
