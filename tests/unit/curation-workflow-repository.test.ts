import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as schema from "../../app/db/schema";
import { createCurationWorkflowRepository } from "../../app/repositories/curation-workflow.server";

describe("curation workflow repository", () => {
  let client: PGlite;
  let repository: ReturnType<typeof createCurationWorkflowRepository>;

  beforeEach(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    repository = createCurationWorkflowRepository(db as never);
    await client.exec(`
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
    `);
  }, 30_000);

  afterEach(async () => client.close());

  it("atomically records an A review, creates only drafts, and enqueues the decision", async () => {
    const result = await repository.finalizeReview(
      {
        submissionId: "20000000-0000-4000-8000-000000000001",
        artisticQuality: 5,
        originalityIntent: 4,
        productionReadiness: 4,
        editorialFit: 5,
        finalGrade: "A",
        rationale: "Distinctive work ready for catalogue preparation.",
      },
      { id: "curator-1", email: "curator@example.test" },
      new Date("2026-09-07T10:30:00Z"),
    );

    expect(result).toMatchObject({ status: "accepted", finalGrade: "A" });
    const decision = await client.query<{
      status: string;
      resulting_track_id: string | null;
      lifecycle_status: string;
      final_grade: string;
      feature_distinction: boolean;
    }>(`
      select submission.status, submission.resulting_track_id, track.lifecycle_status,
        review.final_grade,
        (activity.metadata->>'featureDistinction')::boolean as feature_distinction
      from submissions submission
      join curation_reviews review on review.submission_id = submission.id
      join tracks track on track.id = submission.resulting_track_id
      join submission_activities activity on activity.submission_id = submission.id
        and activity.metadata ? 'curationReviewId'
      where submission.id = '20000000-0000-4000-8000-000000000001'
    `);
    expect(decision.rows[0]).toMatchObject({
      status: "accepted",
      lifecycle_status: "draft",
      final_grade: "A",
      feature_distinction: true,
    });
    const outbox = await client.query<{ count: number }>(
      "select count(*)::integer as count from curation_outbox where kind = 'submission_decision_email'",
    );
    expect(outbox.rows[0]?.count).toBe(1);
  });

  it("rejects stale curator identity without writing any partial decision", async () => {
    const result = await repository.finalizeReview(
      {
        submissionId: "20000000-0000-4000-8000-000000000001",
        artisticQuality: 3,
        originalityIntent: 3,
        productionReadiness: 3,
        editorialFit: 3,
        finalGrade: "B",
        rationale: "Should not be persisted.",
      },
      { id: "different-curator", email: "other@example.test" },
      new Date("2026-09-07T10:30:00Z"),
    );
    expect(result).toBeNull();
    expect((await client.query("select * from curation_reviews")).rows).toHaveLength(0);
    expect((await client.query("select * from tracks")).rows).toHaveLength(0);
    expect((await client.query("select * from curation_outbox")).rows).toHaveLength(0);
  });

  it("creates an expiry cleanup job with each staging upload session", async () => {
    await client.exec(`update submissions set status = 'clarification_requested'`);

    const upload = await repository.createAudioUploadSession(
      "a".repeat(64),
      {
        filename: "next.flac",
        mimeType: "audio/flac",
        checksumSha256: "c".repeat(64),
        byteSize: 8192,
        durationMs: 240000,
        codec: "flac",
      },
      new Date("2026-09-07T12:00:00Z"),
    );

    expect(upload).not.toBeNull();
    const cleanup = await client.query<{
      kind: string;
      payload: { uploadSessionId: string };
      available_at: string;
    }>(
      `select kind, payload, available_at from curation_outbox where kind = 'review_audio_staging_cleanup'`,
    );
    expect(cleanup.rows).toHaveLength(1);
    expect(cleanup.rows[0]).toMatchObject({
      kind: "review_audio_staging_cleanup",
      payload: { uploadSessionId: upload?.id },
    });
    expect(new Date(cleanup.rows[0]!.available_at)).toEqual(upload?.expiresAt);
  });

  it("locks review audio creation and in-flight finalization after submission", async () => {
    await expect(
      repository.createAudioUploadSession(
        "a".repeat(64),
        {
          filename: "too-late.flac",
          mimeType: "audio/flac",
          checksumSha256: "d".repeat(64),
          byteSize: 8192,
          durationMs: 240000,
          codec: "flac",
        },
        new Date("2026-09-07T12:00:00Z"),
      ),
    ).resolves.toBeNull();

    await client.exec(`update submissions set status = 'clarification_requested'`);
    const upload = await repository.createAudioUploadSession(
      "a".repeat(64),
      {
        filename: "in-flight.flac",
        mimeType: "audio/flac",
        checksumSha256: "e".repeat(64),
        byteSize: 8192,
        durationMs: 240000,
        codec: "flac",
      },
      new Date("2026-09-07T12:00:00Z"),
    );
    expect(upload).not.toBeNull();
    if (!upload) return;
    const claimed = await repository.claimAudioFinalization(
      upload.id,
      "a".repeat(64),
      new Date("2026-09-07T12:01:00Z"),
    );
    expect(claimed?.leaseToken).toBeTruthy();
    if (!claimed?.leaseToken) return;

    await client.exec(`update submissions set status = 'received'`);
    await expect(
      repository.completeAudioFinalization(
        upload.id,
        claimed.leaseToken,
        "private/review-audio/final/locked/in-flight",
        new Date("2026-09-07T12:02:00Z"),
      ),
    ).resolves.toBeNull();
    expect(
      (
        await client.query(
          `select id from submission_review_audio where object_key = 'private/review-audio/final/locked/in-flight'`,
        )
      ).rows,
    ).toHaveLength(0);
  });

  it("does not abandon a finalization while its lease is still live", async () => {
    await client.exec(`
      insert into submission_audio_upload_sessions (
        id, submission_id, staging_object_key, original_filename, mime_type,
        checksum_sha256, byte_size, duration_ms, codec, status, lease_token,
        lease_expires_at, expires_at
      ) values (
        '80000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        'private/review-audio/staging/80000000-0000-4000-8000-000000000001',
        'lease.flac', 'audio/flac', repeat('f', 64), 2048, 120000, 'flac',
        'finalizing', '80000000-0000-4000-8000-000000000002',
        '2026-09-07T12:05:00Z', '2026-09-07T11:00:00Z'
      )
    `);

    await expect(
      repository.abandonExpiredAudioUploads(new Date("2026-09-07T12:00:00Z")),
    ).resolves.toBe(0);
    await expect(
      repository.audioUploadStagingCleanupTarget(
        "80000000-0000-4000-8000-000000000001",
        new Date("2026-09-07T12:00:00Z"),
      ),
    ).resolves.toEqual({ status: "defer" });
    await expect(
      repository.abandonExpiredAudioUploads(new Date("2026-09-07T12:06:00Z")),
    ).resolves.toBe(1);
    await expect(
      repository.audioUploadStagingCleanupTarget(
        "80000000-0000-4000-8000-000000000001",
        new Date("2026-09-07T12:06:00Z"),
      ),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("rejects cross-submission pinned governance and upload records", async () => {
    await client.exec(`
      insert into submission_invitations (
        id, public_reference, token_hash, invitee_name, invitee_email, expires_at
      ) values (
        '90000000-0000-4000-8000-000000000001', 'INV-CURATION-002', repeat('d', 64),
        'Other Signal', 'other@example.test', '2030-01-01T00:00:00Z'
      );
      insert into submissions (
        id, invitation_id, public_reference, invitation_reference, submitter_name,
        submitter_email, title, artist_details, status
      ) values (
        '90000000-0000-4000-8000-000000000002',
        '90000000-0000-4000-8000-000000000001', 'SUB-CURATION-002', 'INV-CURATION-002',
        'Other Signal', 'other@example.test', 'Other Frequency', '{}'::jsonb, 'draft'
      );
      insert into rights_declarations (
        id, submission_id, version, revision_author_name, revision_author_email,
        revision_reason, authority_basis, entitlement_statement, public_summary, territories
      ) values (
        '90000000-0000-4000-8000-000000000003',
        '90000000-0000-4000-8000-000000000002', 1, 'Other Signal',
        'other@example.test', 'Submitted', 'original_author', 'Controlled.',
        'Original.', array['Worldwide']
      );
      insert into submission_audio_upload_sessions (
        id, submission_id, staging_object_key, original_filename, mime_type,
        checksum_sha256, byte_size, duration_ms, codec, status, expires_at, completed_at
      ) values (
        '90000000-0000-4000-8000-000000000004',
        '90000000-0000-4000-8000-000000000002',
        'private/review-audio/staging/90000000-0000-4000-8000-000000000004',
        'other.flac', 'audio/flac', repeat('e', 64), 1024, 90000, 'flac',
        'completed', '2026-09-07T11:00:00Z', '2026-09-07T10:10:00Z'
      );
    `);

    await expect(
      client.exec(`
        insert into curation_reviews (
          id, submission_id, version, eligibility, artistic_quality, originality_intent,
          production_readiness, editorial_fit, final_grade, rationale, curator_id,
          curator_email, rights_declaration_id, creative_process_disclosure_id,
          provenance_record_id, review_audio_id, finalized_at
        ) values (
          '90000000-0000-4000-8000-000000000005',
          '20000000-0000-4000-8000-000000000001', 1, 'eligible', 4, 4, 4, 4,
          'B', 'Cross-parent attempt.', 'curator-1', 'curator@example.test',
          '90000000-0000-4000-8000-000000000003',
          '40000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000001',
          '70000000-0000-4000-8000-000000000001', now()
        )
      `),
    ).rejects.toThrow("Pinned rights declaration must belong to the review submission");

    await expect(
      client.exec(`
        insert into submission_review_audio (
          id, submission_id, upload_session_id, version, object_key, original_filename,
          mime_type, checksum_sha256, byte_size, duration_ms, codec, finalized_at
        ) values (
          '90000000-0000-4000-8000-000000000006',
          '20000000-0000-4000-8000-000000000001',
          '90000000-0000-4000-8000-000000000004', 2,
          'private/review-audio/final/cross-parent', 'other.flac', 'audio/flac',
          repeat('e', 64), 1024, 90000, 'flac', now()
        )
      `),
    ).rejects.toThrow("Review audio upload session must belong to the same submission");
  });
});
