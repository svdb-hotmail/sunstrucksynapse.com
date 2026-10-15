import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import type { Database } from "../../app/db/client.server";
import { createSubmissionRepository } from "../../app/repositories/submissions.server";
import { createReleaseIntakeRepository } from "../../app/repositories/release-intake.server";
import { createCurationWorkflowRepository } from "../../app/repositories/curation-workflow.server";
import { createReleasePreparationRepository } from "../../app/repositories/release-preparation.server";
import { createAlbumPublishingRepository } from "../../app/repositories/album-publishing.server";
import { createSubmissionEditRepository } from "../../app/repositories/submission-edit.server";
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
    const saved = await submissions.findByInvitationTokenHash(record.token, new Date());
    assert.deepEqual(saved!.submission.trackDetails.genres, ["Ambient", "Electronic"]);
    assert.deepEqual(saved!.submission.trackDetails.processTags, ["Human composition", "Mixing"]);
    input.release = saved!.submission.releaseDetails;
    return { ...record, input };
  }
  async function beginCover(token: string, checksum = "c".repeat(64)) {
    const id = crypto.randomUUID(),
      lease = crypto.randomUUID();
    assert(
      await intake.createCover(token, {
        id,
        filename: "synthetic.png",
        mimeType: "image/png",
        checksumSha256: checksum,
        byteSize: 100,
        width: 1400,
        height: 1400,
        stagingObjectKey: `private/submission-covers/staging/${id}`,
        expiresAt: new Date(Date.now() + 900000),
      }),
    );
    assert(await intake.claimCover(token, id, lease));
    return { id, lease };
  }
  async function addCover(token: string) {
    const { id, lease } = await beginCover(token);
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
  const editor = createSubmissionEditRepository(db);
  const editable = (await editor.find(first.id))!;
  const curatorCover = crypto.randomUUID();
  await editor.save(
    first.id,
    JSON.stringify(editable.revision),
    editable.fields,
    "Synthetic curator replacement cover",
    actor,
    {
      id: curatorCover,
      objectKey: `private/curator-artwork/${curatorCover}`,
      checksumSha256: "f".repeat(64),
      byteSize: 33,
      width: 1400,
      height: 1400,
      mimeType: "image/png",
      filename: "synthetic.png",
    },
  );
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
  const duplicate = await seed(5);
  await assert.rejects(
    service.saveDraft(
      duplicate.token,
      { ...first.input, release: { ...first.input.release, trackNumber: 1 } },
      meta,
    ),
  );
  assert.notEqual(
    (await submissions.findByInvitationTokenHash(duplicate.token, new Date()))?.submission
      .releaseDetails.albumProjectId,
    first.input.release.albumProjectId,
  );
  assert.equal(await intake.validateAlbumChoice(first.token), true);
  assert.equal(await intake.validateAlbumChoice(second.token), true);
  const moved = await seed(6);
  const single = {
    ...first.input,
    release: {
      ...first.input.release,
      kind: "single" as const,
      albumProjectId: undefined,
      trackNumber: undefined,
    },
  };
  assert.equal((await service.saveDraft(moved.token, single, meta)).ok, true);
  const oldCover = await addCover(moved.token);
  assert.equal(
    (
      await service.saveDraft(
        moved.token,
        { ...first.input, release: { ...first.input.release, trackNumber: 3 } },
        meta,
      )
    ).ok,
    true,
  );
  assert.equal((await intake.currentCover(moved.token))?.id, coverId);
  assert.notEqual(oldCover, coverId);
  // Moving a borrower into a new project removes the previous album's cover.
  assert.equal(
    (
      await service.saveDraft(
        moved.token,
        {
          ...first.input,
          release: {
            ...first.input.release,
            title: "Another project",
            albumProjectId: undefined,
            trackNumber: 1,
          },
        },
        meta,
      )
    ).ok,
    true,
  );
  assert.equal(await intake.currentCover(moved.token), null);
  await assert.rejects(async () => {
    await db.execute(
      sql`update releases set lifecycle_status='published' where id=${releaseId}::uuid`,
    );
  });
  const lineage = rows(
    await db.execute(
      sql`select id,resulting_track_id,accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions where status='accepted' order by id`,
    ),
  );
  await db.execute(sql`update tracks set position=4 where id=${secondId}::uuid`);
  assert(
    (await publisher.readiness(releaseId)).some((r) =>
      r.blockers.includes("complete consecutive track order starting at 1"),
    ),
  );
  await publisher.reorder(releaseId, [secondId, firstId], [firstId, secondId], actor);
  assert.deepEqual(
    (await publisher.inventory())
      .filter((t) => t.releaseId === releaseId)
      .map((t) => [t.id, t.position]),
    [
      [secondId, 1],
      [firstId, 2],
    ],
  );
  await assert.rejects(
    publisher.reorder(releaseId, [firstId, secondId], [firstId, secondId], actor),
  );
  await publisher.reorder(releaseId, [firstId, secondId], [secondId, firstId], actor);
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
  assert.equal(rows(await db.execute(sql`select id from artwork_assets`)).length, 1);
  assert.equal(rows(await db.execute(sql`select id from track_artwork_assets`)).length, 0);
  const editedAlbum = (await publisher.inventory()).filter((t) =>
    [firstId, secondId].includes(t.id),
  );
  assert(editedAlbum.every((t) => t.coverId === curatorCover));
  assert.equal((await intake.currentCover(first.token))?.id, coverId);
  assert.equal((await intake.currentCover(second.token))?.id, coverId);
  const ready = await publisher.readiness(releaseId);
  assert(
    ready.every((t) => t.blockers.length === 0),
    JSON.stringify(ready),
  );
  const slug = await publisher.publish(releaseId, actor);
  assert.equal(await publisher.releaseForAcceptedTrack(firstId), releaseId);
  assert(!(await publisher.inventory()).some((t) => t.id === firstId));
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
  const provider = await save(9);
  const borrower = await save(10, provider.input.release.albumProjectId);
  // Both uploads acquire leases before either finalizes, matching the dangerous
  // concurrent interleaving. PGlite serializes calls; no multi-connection claim.
  const winner = await beginCover(provider.token);
  const contender = await beginCover(borrower.token, "e".repeat(64));
  assert.equal(
    (
      await intake.completeCover(
        provider.token,
        winner.id,
        winner.lease,
        `private/submission-covers/final/${winner.id}/${winner.lease}`,
      )
    )?.id,
    winner.id,
  );
  assert.equal(
    (
      await intake.completeCover(
        borrower.token,
        contender.id,
        contender.lease,
        `private/submission-covers/final/${contender.id}/${contender.lease}`,
      )
    )?.id,
    winner.id,
  );
  assert.equal((await intake.currentCover(borrower.token))?.id, winner.id);
  await assert.rejects(
    service.saveDraft(
      provider.token,
      {
        ...provider.input,
        release: { ...provider.input.release, kind: "single", albumProjectId: undefined },
      },
      meta,
    ),
  );
  assert.equal((await intake.currentCover(borrower.token))?.id, winner.id);
  const cleanup = await intake.coverStagingCleanupTarget(
    contender.id,
    new Date(Date.now() + 20 * 60000),
  );
  assert.deepEqual(cleanup, {
    status: "ready",
    stagingObjectKey: `private/submission-covers/staging/${contender.id}`,
  });
  assert(
    rows(
      await db.execute(
        sql`select id from curation_outbox where kind='cover_staging_cleanup' and payload->>'uploadSessionId'=${contender.id}`,
      ),
    ).length === 1,
  );
  return { releaseId, slug, tracks: 2, publishAuditCount: count };
}
