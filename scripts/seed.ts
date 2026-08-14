import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { validateDatabaseEnv } from "../app/config/env.server";
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
  tracks,
} from "../app/db/schema";

const IDs = {
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
} as const;

const publishedAt = new Date("2026-01-15T12:00:00.000Z");
const submittedAt = new Date("2026-01-10T09:00:00.000Z");
const reviewedAt = new Date("2026-01-12T15:00:00.000Z");
const acceptedAt = new Date("2026-01-13T16:00:00.000Z");
const versionOneFinalizedAt = new Date("2026-01-11T10:00:00.000Z");
const versionTwoFinalizedAt = new Date("2026-01-12T10:00:00.000Z");

const env = validateDatabaseEnv(process.env);
const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

try {
  await db.transaction(async (tx) => {
    await tx
      .insert(artworkAssets)
      .values({
        id: IDs.artwork,
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
        id: IDs.artist,
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
        artistId: IDs.artist,
        artworkAssetId: IDs.artwork,
        role: "avatar",
        position: 1,
        altText: "Abstract sunrise artwork for the fictional Synthetic Dawn Ensemble.",
      })
      .onConflictDoNothing();

    await tx
      .insert(releases)
      .values({
        id: IDs.release,
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
        releaseId: IDs.release,
        artistId: IDs.artist,
        position: 1,
        creditedAs: "Synthetic Dawn Ensemble",
      })
      .onConflictDoNothing();

    await tx
      .insert(releaseArtworkAssets)
      .values({
        releaseId: IDs.release,
        artworkAssetId: IDs.artwork,
        role: "primary",
        position: 1,
        altText: "Cover artwork for Signals Before Sunrise.",
      })
      .onConflictDoNothing();

    await tx
      .insert(tracks)
      .values([
        {
          id: IDs.trackOne,
          releaseId: IDs.release,
          slug: "first-light",
          title: "First Light",
          discNumber: 1,
          position: 1,
          lifecycleStatus: "published",
          publishedAt,
        },
        {
          id: IDs.trackTwo,
          releaseId: IDs.release,
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
        { trackId: IDs.trackOne, artistId: IDs.artist, position: 1 },
        { trackId: IDs.trackTwo, artistId: IDs.artist, position: 1 },
      ])
      .onConflictDoNothing();

    await tx
      .insert(audioAssets)
      .values([
        {
          id: IDs.masterAudio,
          trackId: IDs.trackOne,
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
          id: IDs.derivativeAudio,
          trackId: IDs.trackOne,
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
      .insert(editorialCollections)
      .values({
        id: IDs.collection,
        slug: "early-signals",
        name: "Early Signals",
        description: "A fictional launch collection for deterministic development data.",
        artworkAssetId: IDs.artwork,
        lifecycleStatus: "published",
        publishedAt,
      })
      .onConflictDoNothing();

    await tx
      .insert(collectionItems)
      .values([
        {
          id: IDs.collectionRelease,
          collectionId: IDs.collection,
          releaseId: IDs.release,
          position: 1,
          annotation: "A complete fictional release.",
        },
        {
          id: IDs.collectionTrack,
          collectionId: IDs.collection,
          trackId: IDs.trackTwo,
          position: 2,
          annotation: "A focused fictional track selection.",
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(submissions)
      .values({
        id: IDs.submission,
        invitationReference: "seed-invitation-001",
        submitterName: "Synthetic Dawn Ensemble",
        submitterEmail: "artist@example.invalid",
        title: "Signals Before Sunrise",
        status: "accepted",
        submittedAt,
        reviewedAt,
        acceptedAt,
        resultingReleaseId: IDs.release,
        reviewNotes: "Synthetic accepted seed submission; acceptance is separate from publication.",
      })
      .onConflictDoNothing();

    await tx
      .insert(rightsDeclarations)
      .values([
        {
          id: IDs.rightsOne,
          submissionId: IDs.submission,
          version: 1,
          status: "superseded",
          authorityBasis: "original_author",
          containsThirdPartyMaterial: false,
          restrictions: "Development data only.",
          attestation: "Synthetic version-one rights attestation.",
          attestedAt: versionOneFinalizedAt,
        },
        {
          id: IDs.rightsTwo,
          submissionId: IDs.submission,
          version: 2,
          supersedesId: IDs.rightsOne,
          status: "attested",
          authorityBasis: "original_author",
          containsThirdPartyMaterial: false,
          restrictions: "Development data only; no real-world rights are asserted.",
          attestation: "Synthetic version-two rights attestation.",
          attestedAt: versionTwoFinalizedAt,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(creativeProcessDisclosures)
      .values([
        {
          id: IDs.disclosureOne,
          submissionId: IDs.submission,
          version: 1,
          status: "superseded",
          aiUsed: true,
          aiUseDescription: "A fictional generative sketch informed arrangement experiments.",
          meaningfulHumanContribution: "Human composition, arrangement, performance, and editing.",
          toolsAndSystems: ["Fictional Sketch Model"],
          sourceMaterialContext: "No third-party source recording was used.",
          artistSummary: "An early fictional disclosure retained for revision history.",
          finalizedAt: versionOneFinalizedAt,
        },
        {
          id: IDs.disclosureTwo,
          submissionId: IDs.submission,
          version: 2,
          supersedesId: IDs.disclosureOne,
          status: "finalized",
          aiUsed: true,
          aiUseDescription: "A fictional generative sketch was used for ideation only.",
          meaningfulHumanContribution:
            "The artist composed, arranged, performed, selected, edited, and mixed the work.",
          toolsAndSystems: ["Fictional Sketch Model", "Digital Audio Workstation"],
          sourceMaterialContext: "No third-party source recording was used.",
          artistSummary: "AI supported ideation; the artist directed and completed the music.",
          finalizedAt: versionTwoFinalizedAt,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(provenanceRecords)
      .values([
        {
          id: IDs.provenanceOne,
          submissionId: IDs.submission,
          version: 1,
          status: "superseded",
          summary: "Initial fictional process record.",
          finalizedAt: versionOneFinalizedAt,
        },
        {
          id: IDs.provenanceTwo,
          submissionId: IDs.submission,
          version: 2,
          supersedesId: IDs.provenanceOne,
          status: "finalized",
          summary: "Revised fictional process and source record with private evidence metadata.",
          finalizedAt: versionTwoFinalizedAt,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(provenanceSteps)
      .values({
        id: IDs.provenanceStep,
        provenanceRecordId: IDs.provenanceTwo,
        position: 1,
        processType: "arrangement",
        description: "The artist selected a sketch and rebuilt the arrangement.",
      })
      .onConflictDoNothing();

    await tx
      .insert(provenanceSources)
      .values({
        id: IDs.provenanceSource,
        provenanceRecordId: IDs.provenanceTwo,
        position: 1,
        sourceType: "generated_material",
        reference: "Internal sketch reference seed-sketch-001",
        rightsContext: "Synthetic development data with no external rights claim.",
      })
      .onConflictDoNothing();

    await tx
      .insert(provenanceEvidence)
      .values({
        id: IDs.provenanceEvidence,
        provenanceRecordId: IDs.provenanceTwo,
        storageProvider: "private-r2",
        objectKey: "evidence/private/seed-sketch-001.txt",
        mimeType: "text/plain",
        checksumSha256: "4".repeat(64),
        byteSize: 512,
      })
      .onConflictDoNothing();
  });

  console.log("Database seed is present.");
} finally {
  await client.end();
}
