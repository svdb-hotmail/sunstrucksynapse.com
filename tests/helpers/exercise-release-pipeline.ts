import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import type { Database } from "../../app/db/client.server";
import { createSubmissionRepository } from "../../app/repositories/submissions.server";
import { createReleaseIntakeRepository } from "../../app/repositories/release-intake.server";
import { createCurationWorkflowRepository } from "../../app/repositories/curation-workflow.server";
import { createReleasePreparationRepository } from "../../app/repositories/release-preparation.server";
import { createAlbumPublishingRepository } from "../../app/repositories/album-publishing.server";
import { SubmissionService } from "../../app/services/submissions.server";
import { STREAMING_PROFILE } from "../../app/config/music-metadata";
import { validateEncodingOutput } from "../../app/services/encoding-contract";
import { completeDraft, releaseSubmissionFixture } from "./release-submission";

function rows<T>(value: unknown): T[] {
  return (Array.isArray(value) ? value : (value as { rows: T[] }).rows) as T[];
}
const actor = { id: "curator-1", email: "curator@example.test" };
const meta = { honeypotTriggered: false, userAgent: "isolated-verification", ipHash: null };
const review = {
  artisticQuality: 4,
  originalityIntent: 4,
  productionReadiness: 4,
  editorialFit: 4,
  finalGrade: "B" as const,
  rationale: "Synthetic isolated verification only.",
};

// Run the actual repositories, service validation and transactional publication
// on both PGlite and Neon HTTP. No production host is selected by this helper.
export async function exerciseReleasePipeline(db: Database) {
  const submissions = createSubmissionRepository(db);
  const intake = createReleaseIntakeRepository(db);
  const workflow = createCurationWorkflowRepository(db);
  const preparation = createReleasePreparationRepository(db);
  const publisher = createAlbumPublishingRepository(db);
  const service = new SubmissionService(submissions, { mode: "noop", send: async () => {} });
  async function seed(n: number, outsider = false) {
    for (const query of releaseSubmissionFixture(n)
      .split(";")
      .filter((q) => q.trim()))
      await db.execute(
        sql.raw(outsider ? query.replaceAll("artist@example.test", "other@example.test") : query),
      );
    const id = `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    await db.execute(
      sql`update submissions set status='draft',submitted_at=null,assigned_curator_id=null,assigned_curator_email=null,assigned_at=null,reviewed_at=null where id=${id}::uuid`,
    );
    return { id, token: n.toString(16).repeat(64) };
  }
  async function save(n: number, albumProjectId?: string, outsider = false) {
    const record = await seed(n, outsider);
    const input = completeDraft();
    input.artist.displayName = "New Signal";
    input.track = {
      ...input.track,
      intakeVersion: 1,
      genres: ["Ambient", "Electronic"],
      moods: ["Calm", "Reflective"],
      processTags: ["Human composition", "Mixing"],
    };
    input.release = {
      ...input.release,
      kind: "album",
      title: "Synthetic album",
      trackNumber: n,
      albumProjectId,
      artworkRightsConfirmed: true,
    };
    if (outsider) {
      await assert.rejects(service.saveDraft(record.token, input, meta));
      return { ...record, input };
    }
    assert.equal((await service.saveDraft(record.token, input, meta)).ok, true);
    await intake.saveAlbumChoice(record.token, input);
    await intake.reuseAlbumCover(record.token);
    const saved = await submissions.findByInvitationTokenHash(record.token, new Date());
    assert.deepEqual(saved!.submission.trackDetails.genres, ["Ambient", "Electronic"]);
    assert.deepEqual(saved!.submission.trackDetails.processTags, ["Human composition", "Mixing"]);
    input.release = saved!.submission.releaseDetails;
    return { ...record, input };
  }
  async function addCover(token: string) {
    const id = crypto.randomUUID(),
      lease = crypto.randomUUID();
    assert(
      await intake.createCover(token, {
        id,
        filename: "synthetic.png",
        mimeType: "image/png",
        checksumSha256: "c".repeat(64),
        byteSize: 100,
        width: 1400,
        height: 1400,
        stagingObjectKey: `private/submission-covers/staging/${id}`,
        expiresAt: new Date(Date.now() + 900000),
      }),
    );
    assert(await intake.claimCover(token, id, lease));
    assert.equal(
      await intake.completeCover(
        token,
        id,
        crypto.randomUUID(),
        `private/submission-covers/final/${id}/${lease}`,
      ),
      null,
    );
    assert(
      await intake.completeCover(
        token,
        id,
        lease,
        `private/submission-covers/final/${id}/${lease}`,
      ),
    );
    return id;
  }
  async function accept(record: Awaited<ReturnType<typeof save>>) {
    assert.equal((await service.submit(record.token, record.input, meta)).ok, true);
    assert.equal(await workflow.claimNextSubmission(actor, new Date()), record.id);
    const decision = await workflow.finalizeReview(
      { submissionId: record.id, ...review },
      actor,
      new Date(),
    );
    assert(decision?.resultingTrackId);
    return decision.resultingTrackId;
  }
  const first = await save(1);
  const coverId = await addCover(first.token);
  const firstId = await accept(first);
  const second = await save(2, first.input.release.albumProjectId);
  assert.equal((await intake.currentCover(second.token))?.id, coverId);
  assert.equal((await intake.findCover(coverId, second.token))?.id, coverId);
  const secondId = await accept(second);
  const third = await save(3, first.input.release.albumProjectId, true);
  assert.equal(await intake.findCover(coverId, third.token), null);
  assert.equal(await intake.validateAlbumChoice(third.token), false);
  const inventory = (await publisher.inventory()).filter((t) => [firstId, secondId].includes(t.id));
  assert.equal(new Set(inventory.map((t) => t.releaseId)).size, 1);
  assert.equal(new Set(inventory.map((t) => t.artistId)).size, 1);
  assert.deepEqual(
    inventory.map((t) => t.position),
    [1, 2],
  );
  assert.deepEqual(inventory[0].genres, ["Ambient", "Electronic"]);
  const releaseId = inventory[0].releaseId;
  const lineage = rows(
    await db.execute(
      sql`select id,resulting_track_id,accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions where status='accepted' order by id`,
    ),
  );
  await assert.rejects(publisher.publish(releaseId, actor));
  assert(
    rows<{ blockers: string[] }>(await publisher.readiness(releaseId)).some(
      (t) => t.blockers.length > 0,
    ),
  );
  const held = await preparation.claim();
  assert(held);
  assert.equal(await preparation.claim(), null);
  // Reset the deliberately held jobs by expiring their leases, then exercise
  // stale completion and automatic recovery under different fenced output keys.
  await db.execute(
    sql`update release_preparation_jobs set lease_expires_at=now()-interval '1 second' where status='processing'`,
  );
  for (let n = 0; n < 2; n++) {
    const job = await preparation.claim();
    assert(job);
    const output = {
      objectKey: job.outputKey,
      checksumSha256: "d".repeat(64),
      byteSize: 7200000,
      durationMs: 180000,
      sampleRate: 44100,
      channels: 2,
      bitRate: 320000,
      profile: STREAMING_PROFILE,
    };
    assert.throws(() => validateEncodingOutput(job, { ...output, objectKey: job.sourceKey }));
    assert.throws(() => validateEncodingOutput(job, { ...output, channels: 1 }));
    if (job.id === held.id) {
      assert.notEqual(held.outputKey, job.outputKey);
      assert.equal(
        await preparation.complete(held, { ...output, objectKey: held.outputKey }),
        false,
      );
    }
    assert.equal(await preparation.complete(job, validateEncodingOutput(job, output)), true);
    await assert.rejects(async () => {
      await db.execute(
        sql`update release_preparation_jobs set output_checksum=${"a".repeat(64)} where id=${job.id}::uuid`,
      );
    });
  }
  assert.equal(rows(await db.execute(sql`select id from audio_assets`)).length, 0);
  assert.equal(rows(await db.execute(sql`select id from artwork_assets`)).length, 0);
  const ready = await publisher.readiness(releaseId);
  assert(
    ready.every((t) => t.blockers.length === 0),
    JSON.stringify(ready),
  );
  const slug = await publisher.publish(releaseId, actor);
  assert.equal(
    rows(await db.execute(sql`select id from audio_assets where scope='publishable_derivative'`))
      .length,
    2,
  );
  const count = rows<{ count: number }>(
    await db.execute(
      sql`select count(*)::int as count from publication_audit where to_lifecycle='published'`,
    ),
  )[0].count;
  assert.equal(await publisher.publish(releaseId, actor), slug);
  assert.equal(
    rows<{ count: number }>(
      await db.execute(
        sql`select count(*)::int as count from publication_audit where to_lifecycle='published'`,
      ),
    )[0].count,
    count,
  );
  assert.deepEqual(
    rows(
      await db.execute(
        sql`select id,resulting_track_id,accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions where status='accepted' order by id`,
      ),
    ),
    lineage,
  );
  const legacy = await seed(4);
  await db.execute(
    sql`update submissions set status='listening',submitted_at=now(),reviewed_at=now(),assigned_curator_id='curator-1',assigned_curator_email='curator@example.test',assigned_at=now() where id=${legacy.id}::uuid`,
  );
  const legacyDecision = await workflow.finalizeReview(
    { submissionId: legacy.id, ...review },
    actor,
    new Date(),
  );
  assert(legacyDecision?.resultingTrackId);
  const before = rows(
    await db.execute(
      sql`select accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions where id=${legacy.id}::uuid`,
    ),
  );
  const legacyCover = await addCover(legacy.token);
  const legacyJob = rows<{ coverId: string }>(
    await db.execute(
      sql`select cover_id as "coverId" from release_preparation_jobs where track_id=${legacyDecision.resultingTrackId}::uuid`,
    ),
  )[0];
  assert.equal(legacyJob.coverId, legacyCover);
  assert.deepEqual(
    rows(
      await db.execute(
        sql`select accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions where id=${legacy.id}::uuid`,
      ),
    ),
    before,
  );
  await assert.rejects(async () => {
    await db.execute(
      sql`update submission_cover_selections set cover_id=${coverId}::uuid where submission_id=${legacy.id}::uuid`,
    );
  });
  const interrupted = await preparation.claim();
  assert(interrupted);
  await db.execute(
    sql`update release_preparation_jobs set attempts=4,lease_expires_at=now()-interval '1 second' where id=${interrupted.id}::uuid`,
  );
  assert.equal(await preparation.claim(), null);
  assert.equal(
    rows<{ status: string }>(
      await db.execute(
        sql`select status from release_preparation_jobs where id=${interrupted.id}::uuid`,
      ),
    )[0].status,
    "failed",
  );
  await preparation.retry(legacyDecision.resultingTrackId, actor);
  assert.equal((await preparation.claim())?.id, interrupted.id);
  return { releaseId, slug, tracks: 2, publishAuditCount: count };
}
