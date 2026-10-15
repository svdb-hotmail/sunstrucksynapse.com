import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import * as schema from "../../app/db/schema";
import { createCurationWorkflowRepository } from "../../app/repositories/curation-workflow.server";
import { createReleaseIntakeRepository } from "../../app/repositories/release-intake.server";
import { createReleasePreparationRepository } from "../../app/repositories/release-preparation.server";
import { STREAMING_PROFILE } from "../../app/config/music-metadata";
import { createAlbumPublishingRepository } from "../../app/repositories/album-publishing.server";
import type { Database } from "../../app/db/client.server";

describe("album publishing atomicity", () => {
  const actor = { id: "curator-1", email: "curator@example.test" };
  const releaseId = "90000000-0000-4000-8000-000000000001";
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: ReturnType<typeof createAlbumPublishingRepository>;
  let trackIds: string[];
  let artistId: string;
  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    const fixture = `
      insert into submission_invitations (
        id, public_reference, token_hash, invitee_name, invitee_email, expires_at
      ) values (
        '10000000-0000-4000-8000-000000000001', 'INV-CURATION-001', repeat('a', 64),
        'New Signal', 'artist@example.test', '2030-01-01T00:00:00Z'
      );
      insert into submissions (
        id, invitation_id, public_reference, invitation_reference, submitter_name,
        submitter_email, title, artist_details, status, submitted_at, reviewed_at,
        assigned_curator_id, assigned_curator_email, assigned_at
      ) values (
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001', 'SUB-CURATION-001', 'INV-CURATION-001',
        'New Signal', 'artist@example.test', 'Unwritten Frequency',
        '{"displayName":"New Signal","shortBiography":"Human-directed radio music."}'::jsonb,
        'listening', '2026-09-07T10:00:00Z', '2026-09-07T10:05:00Z',
        'curator-1', 'curator@example.test', '2026-09-07T10:05:00Z'
      );
      insert into rights_declarations (
        id, submission_id, version, revision_author_name, revision_author_email,
        revision_reason, authority_basis, entitlement_statement, public_summary,
        territories
      ) values (
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001', 1, 'New Signal',
        'artist@example.test', 'Submitted', 'original_author', 'I control these rights.',
        'Original composition.', array['Worldwide']
      );
      update rights_declarations set status = 'attested', attestation = 'Accurate',
        attested_at = '2026-09-07T10:00:00Z'
      where id = '30000000-0000-4000-8000-000000000001';
      insert into creative_process_disclosures (
        id, submission_id, version, revision_author_name, revision_author_email,
        revision_reason, ai_used, meaningful_human_contribution, human_roles,
        artist_summary
      ) values (
        '40000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001', 1, 'New Signal',
        'artist@example.test', 'Submitted', false, 'Composition and final production.',
        '[{"name":"New Signal","role":"artist","contribution":"composition"}]'::jsonb,
        'Human-composed and produced.'
      );
      update creative_process_disclosures set status = 'finalized',
        finalized_at = '2026-09-07T10:00:00Z'
      where id = '40000000-0000-4000-8000-000000000001';
      insert into provenance_records (
        id, submission_id, version, revision_author_name, revision_author_email,
        revision_reason, summary
      ) values (
        '50000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001', 1, 'New Signal',
        'artist@example.test', 'Submitted', 'Recorded and mixed by the artist.'
      );
      update provenance_records set status = 'finalized', finalized_at = '2026-09-07T10:00:00Z'
      where id = '50000000-0000-4000-8000-000000000001';
      insert into submission_audio_upload_sessions (
        id, submission_id, staging_object_key, original_filename, mime_type,
        checksum_sha256, byte_size, duration_ms, codec, status, expires_at, completed_at
      ) values (
        '60000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        'private/review-audio/staging/60000000-0000-4000-8000-000000000001',
        'signal.flac', 'audio/flac', repeat('b', 64), 4096, 180000, 'flac',
        'completed', '2026-09-07T11:00:00Z', '2026-09-07T10:10:00Z'
      );
      insert into submission_review_audio (
        id, submission_id, upload_session_id, version, object_key, original_filename,
        mime_type, checksum_sha256, byte_size, duration_ms, codec, finalized_at
      ) values (
        '70000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000001', 1,
        'private/review-audio/final/20000000-0000-4000-8000-000000000001/signal',
        'signal.flac', 'audio/flac', repeat('b', 64), 4096, 180000, 'flac',
        '2026-09-07T10:10:00Z'
      );
      insert into submission_review_audio_selections (submission_id, audio_id) values (
        '20000000-0000-4000-8000-000000000001',
        '70000000-0000-4000-8000-000000000001'
      );
    `;
    const workflow = createCurationWorkflowRepository(db as unknown as Database);
    trackIds = [];
    for (const n of [1, 2]) {
      await client.exec(
        n === 1
          ? fixture
          : fixture
              .replaceAll("000000000001", "000000000002")
              .replaceAll("CURATION-001", "CURATION-002")
              .replaceAll("repeat('a', 64)", "repeat('b', 64)"),
      );
      const sid = `20000000-0000-4000-8000-00000000000${n}`;
      const token = (n === 1 ? "a" : "b").repeat(64);
      await client.query("update submissions set status='draft',submitted_at=null where id=$1", [
        sid,
      ]);
      const intake = createReleaseIntakeRepository(db as never);
      const coverId = crypto.randomUUID(),
        lease = crypto.randomUUID();
      await intake.createCover(token, {
        id: coverId,
        filename: "synthetic-test-cover.png",
        mimeType: "image/png",
        checksumSha256: "c".repeat(64),
        byteSize: 100,
        width: 1400,
        height: 1400,
        stagingObjectKey: `private/submission-covers/staging/${coverId}`,
        expiresAt: new Date(Date.now() + 900000),
      });
      expect(await intake.claimCover(token, coverId, lease)).not.toBeNull();
      expect(
        await intake.completeCover(
          token,
          coverId,
          lease,
          `private/submission-covers/final/${coverId}/${lease}`,
        ),
      ).not.toBeNull();
      await client.query(
        "update submissions set status='listening',submitted_at=now() where id=$1",
        [sid],
      );
      const result = await workflow.finalizeReview(
        {
          submissionId: `20000000-0000-4000-8000-00000000000${n}`,
          artisticQuality: 4,
          originalityIntent: 4,
          productionReadiness: 4,
          editorialFit: 4,
          finalGrade: "B",
          rationale: "Explicit synthetic test review.",
        },
        actor,
        new Date(),
      );
      trackIds.push(result!.resultingTrackId!);
    }
    artistId = (await db.select().from(schema.artists))[0].id;
    // PGlite has no Neon HTTP batch. Execute the same lazy statements inside a
    // real PostgreSQL transaction, including SQL locks and rollback semantics.
    const adapter = Object.create(db);
    adapter.batch = async (queries: Promise<unknown>[]) => {
      await client.exec("begin");
      try {
        const results = [];
        for (const query of queries) results.push(await query);
        await client.exec("commit");
        return results;
      } catch (error) {
        await client.exec("rollback");
        throw error;
      }
    };
    repository = createAlbumPublishingRepository(adapter as Database);
  }, 30000);
  afterAll(async () => client.close());
  function preparation(ids = trackIds) {
    return {
      releaseId,
      artistId,
      title: "A full album",
      slug: "a-full-album",
      tracks: ids.map((id, index) => ({
        id,
        title: `Track ${index + 1}`,
        genre: "Ambient",
        moods: ["Calm"],
        processTags: ["Human direction"],
      })),
    };
  }
  it("assembles accepted tracks without changing pinned review lineage", async () => {
    expect((await repository.inventory()).every((track) => track.genre === "")).toBe(true);
    const artists = await db.select().from(schema.artists);
    const originalArtist = artistId;
    artistId = artists.find((artist) => artist.id !== originalArtist)!.id;
    // Legal across separate source releases, but collides after assembly.
    await client.exec("update tracks set slug='shared-track-name'");
    await db.insert(schema.trackArtistCredits).values({
      trackId: trackIds[0],
      artistId,
      position: 2,
      creditedAs: "Secondary alias",
    });
    await client.exec("begin");
    await db.insert(schema.releases).values({ id: releaseId, title: "Draft", slug: "draft" });
    await db.insert(schema.releaseArtistCredits).values([
      { releaseId, artistId: originalArtist, position: 1, creditedAs: "Previous artist alias" },
      { releaseId, artistId, position: 2, creditedAs: "Secondary alias" },
    ]);
    await client.exec("commit");
    const before = await client.query(
      "select resulting_track_id,accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions order by id",
    );
    await repository.prepare(preparation(), actor);
    const regrouped = (await client.query<{ slug: string }>("select slug from tracks")).rows;
    expect(new Set(regrouped.map((track) => track.slug)).size).toBe(2);
    expect(regrouped.every((track) => track.slug.startsWith("shared-track-name-"))).toBe(true);
    const credits = await db.select().from(schema.releaseArtistCredits);
    expect(credits).toContainEqual(
      expect.objectContaining({ releaseId, artistId, position: 1, creditedAs: null }),
    );
    expect(credits.filter((credit) => credit.releaseId === releaseId)).toHaveLength(1);
    expect(
      (await db.select().from(schema.trackArtistCredits)).filter(
        (credit) => credit.trackId === trackIds[0] && credit.artistId === artistId,
      ),
    ).toEqual([expect.objectContaining({ position: 1, creditedAs: null })]);
    expect(
      (
        await db
          .select()
          .from(schema.tracks)
          .where((await import("drizzle-orm")).eq(schema.tracks.releaseId, releaseId))
      ).map((t) => t.position),
    ).toEqual([1, 2]);
    expect(
      (
        await client.query(
          "select resulting_track_id,accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions order by id",
        )
      ).rows,
    ).toEqual(before.rows);
    expect((await client.query("select * from curation_reviews")).rows).toHaveLength(2);
    const audit = await client.query<{ reason: string }>(
      "select reason from publication_audit where entity_type='track' and reason like '%Previous grouping%'",
    );
    expect(audit.rows).toHaveLength(2);
    expect(
      audit.rows.every(
        (row) => row.reason.includes("primaryArtistId") && row.reason.includes(releaseId),
      ),
    ).toBe(true);
  });
  it("rejects a missing/unaccepted track and rolls back all regrouping", async () => {
    await expect(
      repository.prepare(preparation([trackIds[0], "99999999-0000-4000-8000-000000000001"]), actor),
    ).rejects.toThrow();
    expect(
      (
        await client.query<{ id: string }>(
          "select id from tracks where release_id='" + releaseId + "' order by position",
        )
      ).rows.map((row) => row.id),
    ).toEqual(trackIds);
  });
  it("rejects publication with private-only media and does not publish parents", async () => {
    expect(
      (await repository.readiness(releaseId)).some((t) =>
        t.blockers.includes("verified automatic streaming preparation"),
      ),
    ).toBe(true);
    await expect(repository.publish(releaseId, actor)).rejects.toThrow();
    expect(
      (
        await client.query<{ lifecycle_status: string }>(
          "select lifecycle_status from releases where id='" + releaseId + "'",
        )
      ).rows[0].lifecycle_status,
    ).toBe("draft");
    expect(
      (await client.query("select * from publication_audit where to_lifecycle='published'")).rows,
    ).toHaveLength(0);
  });
  it("reorders safely, publishes prepared audio and artist cover atomically, and retries once", async () => {
    await repository.prepare(preparation([...trackIds].reverse()), actor);
    const preparationJobs = createReleasePreparationRepository(db as never);
    for (let n = 0; n < trackIds.length; n++) {
      const job = await preparationJobs.claim();
      expect(job).not.toBeNull();
      expect(
        await preparationJobs.complete(job!, {
          objectKey: job!.outputKey,
          profile: STREAMING_PROFILE,
          checksumSha256: "d".repeat(64),
          byteSize: 7200000,
          durationMs: 180000,
          sampleRate: 44100,
          channels: 2,
          bitRate: 320000,
        }),
      ).toBe(true);
    }
    // Completing preparation does not register publicly deliverable assets.
    expect(await db.select().from(schema.audioAssets)).toHaveLength(0);
    expect(await db.select().from(schema.artworkAssets)).toHaveLength(0);
    expect((await repository.readiness(releaseId)).every((t) => t.blockers.length === 0)).toBe(
      true,
    );
    await expect(repository.publish(releaseId, actor, [trackIds[0]])).rejects.toThrow();
    expect(await db.select().from(schema.audioAssets)).toHaveLength(0);
    expect(await repository.publish(releaseId, actor, [...trackIds].reverse())).toBe(
      "a-full-album",
    );
    expect(await db.select().from(schema.audioAssets)).toHaveLength(2);
    const linkedCovers = await db.select().from(schema.trackArtworkAssets);
    expect(linkedCovers).toHaveLength(2);
    expect(new Set(linkedCovers.map((c) => c.artworkAssetId)).size).toBe(1);
    const audit = (
      await client.query("select * from publication_audit where to_lifecycle='published'")
    ).rows;
    expect(audit).toHaveLength(4);
    expect(await repository.publish(releaseId, actor)).toBe("a-full-album");
    expect(
      (await client.query("select * from publication_audit where to_lifecycle='published'")).rows,
    ).toEqual(audit);
    expect(
      (
        await client.query<{ id: string }>(
          "select id from tracks where release_id='" + releaseId + "' order by position",
        )
      ).rows.map((row) => row.id),
    ).toEqual([...trackIds].reverse());
    await expect(repository.prepare(preparation(), actor)).rejects.toThrow();
  });
});
