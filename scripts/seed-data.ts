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
  tracks,
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
} as const;

const publishedAt = new Date("2026-01-15T12:00:00.000Z");
const submittedAt = new Date("2026-01-10T09:00:00.000Z");
const reviewedAt = new Date("2026-01-12T15:00:00.000Z");
const acceptedAt = new Date("2026-01-13T16:00:00.000Z");
const versionOneFinalizedAt = new Date("2026-01-11T10:00:00.000Z");
const versionTwoFinalizedAt = new Date("2026-01-12T10:00:00.000Z");

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
      .insert(editorialCollections)
      .values({
        id: seedIds.collection,
        slug: "early-signals",
        name: "Early Signals",
        description: "A fictional launch collection for deterministic development data.",
        artworkAssetId: seedIds.artwork,
        lifecycleStatus: "published",
        publishedAt,
      })
      .onConflictDoNothing();

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
  });
}
