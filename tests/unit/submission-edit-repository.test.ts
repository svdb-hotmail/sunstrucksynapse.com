import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import * as schema from "../../app/db/schema";
import type { Database } from "../../app/db/client.server";
import { createSubmissionEditRepository } from "../../app/repositories/submission-edit.server";
import { createCurationWorkflowRepository } from "../../app/repositories/curation-workflow.server";
import { createReleasePreparationRepository } from "../../app/repositories/release-preparation.server";
import { createAlbumPublishingRepository } from "../../app/repositories/album-publishing.server";
import { releaseSubmissionFixture } from "../helpers/release-submission";
import { loader as deliverMedia } from "../../app/routes/media";
import { createMediaDeliveryUrl } from "../../app/services/media-signing";
import type { LoaderFunctionArgs } from "react-router";
import { STREAMING_PROFILE } from "../../app/config/music-metadata";

it("edits a legacy submission, preserves accepted evidence, and publishes with curator artwork", async () => {
  const client = new PGlite();
  try {
    const raw = drizzle(client, { schema });
    await migrate(raw, { migrationsFolder: "./drizzle" });
    const adapter = Object.create(raw);
    let afterCommit: (() => Promise<void>) | undefined;
    adapter.batch = async (queries: Promise<unknown>[]) => {
      await client.exec("begin");
      try {
        const results = [];
        for (const query of queries) results.push(await query);
        await client.exec("commit");
        await afterCommit?.();
        return results;
      } catch (e) {
        await client.exec("rollback");
        throw e;
      }
    };
    const db = adapter as Database;
    for (const query of releaseSubmissionFixture(1)
      .split(";")
      .filter((q) => q.trim()))
      await db.execute(sql.raw(query));
    const id = "20000000-0000-4000-8000-000000000001";
    const actor = { id: "curator-1", email: "curator@example.test" };
    const edits = createSubmissionEditRepository(db);
    const original = (await edits.find(id))!;
    const fields = {
      ...original.fields,
      title: "Corrected signal",
      releaseTitle: "Edited release",
      summary: "Artist-approved description.",
      genres: ["Ambient"],
      moods: ["Calm"],
      processTags: ["Mixing"],
    };
    const saved = (await edits.save(
      id,
      JSON.stringify(original.revision),
      fields,
      "Title correction supplied by artist",
      actor,
    ))!;
    expect(saved.fields).toEqual(fields);
    await expect(
      edits.save(
        id,
        JSON.stringify(original.revision),
        { ...fields, title: "Stale edit" },
        "Stale correction",
        actor,
      ),
    ).rejects.toThrow();
    expect((await edits.find(id))?.fields.title).toBe("Corrected signal");
    expect(
      (await client.query<{ title: string }>("select title from submissions")).rows[0].title,
    ).toBe("Unwritten Frequency");
    await expect(
      client.exec(
        "update submission_activities set message='Rewrite history' where metadata->>'kind'='curator_metadata'",
      ),
    ).rejects.toThrow("append-only");
    // Simulate another committed correction immediately after the save batch.
    afterCommit = async () => {
      afterCommit = undefined;
      await raw.execute(sql`insert into submission_activities(submission_id,activity_type,actor_role,actor_id,actor_email,message,metadata)
        values(${id}::uuid,'note','curator','other','other@example.test','Competing correction',jsonb_build_object('kind','curator_metadata','fields',${JSON.stringify(fields)}::jsonb))`);
    };
    const ownSave = (await edits.save(
      id,
      JSON.stringify(saved.revision),
      fields,
      "Save before competing correction",
      actor,
    ))!;
    expect(ownSave.revision).not.toEqual((await edits.find(id))!.revision);
    await expect(
      edits.save(id, JSON.stringify(ownSave.revision), fields, "Must detect competitor", actor),
    ).rejects.toThrow();
    const decision = await createCurationWorkflowRepository(db).finalizeReview(
      {
        submissionId: id,
        artisticQuality: 4,
        originalityIntent: 4,
        productionReadiness: 4,
        editorialFit: 4,
        finalGrade: "B",
        rationale: "Synthetic isolated verification.",
      },
      actor,
      new Date(),
    );
    expect(decision?.resultingTrackId).toBeTruthy();
    const accepted = (await edits.find(id))!;
    expect(accepted.fields).toEqual(fields);
    const pins = (
      await client.query(
        "select resulting_track_id,accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions where id='20000000-0000-4000-8000-000000000001'",
      )
    ).rows;
    const preparation = createReleasePreparationRepository(db);
    const job = (await preparation.claim())!;
    expect(job).toBeTruthy(); // Missing artwork must not block private audio preparation.
    expect(
      await preparation.complete(job, {
        objectKey: job.outputKey,
        checksumSha256: "d".repeat(64),
        byteSize: 4096,
        durationMs: 180000,
        sampleRate: 44100,
        channels: 2,
        bitRate: 320000,
        profile: STREAMING_PROFILE,
      }),
    ).toBe(true);
    const publishing = createAlbumPublishingRepository(db);
    expect(
      (await publishing.readiness(accepted.releaseId!))
        .flatMap((r) => r.blockers)
        .some((s) => s.includes("cover")),
    ).toBe(true);
    await expect(publishing.publish(accepted.releaseId!, actor)).rejects.toThrow();
    const artwork = {
      id: crypto.randomUUID(),
      objectKey: "private/curator-artwork/synthetic",
      checksumSha256: "e".repeat(64),
      byteSize: 33,
      width: 1400,
      height: 1400,
      mimeType: "image/png",
      filename: "synthetic.png",
    };
    const withCover = (await edits.save(
      id,
      JSON.stringify(accepted.revision),
      { ...fields, title: "Final signal" },
      "Artist supplied missing artwork",
      actor,
      artwork,
    ))!;
    expect(withCover.coverId).toBe(artwork.id);
    const secret = "synthetic-media-secret";
    const signed = await createMediaDeliveryUrl("", "artwork", artwork.id, secret);
    const delivery = (path: string) =>
      deliverMedia({
        request: new Request(new URL(path, "https://example.test")),
        params: { kind: "artwork", assetId: artwork.id },
        context: {
          get: () => ({
            db,
            env: {
              MEDIA_DELIVERY_SIGNING_SECRET: secret,
              MEDIA_BUCKET: {
                get: async () => ({
                  body: "cover",
                  size: 5,
                  httpEtag: '"test"',
                  writeHttpMetadata: () => {},
                }),
              },
            },
          }),
        },
      } as unknown as LoaderFunctionArgs);
    expect((await delivery(`/media/artwork/${artwork.id}`)).status).toBe(404);
    expect((await delivery(signed)).status).toBe(404);
    expect(
      (await client.query("select status,cover_id from release_preparation_jobs")).rows,
    ).toEqual([{ status: "ready", cover_id: null }]);
    expect((await publishing.readiness(accepted.releaseId!)).flatMap((r) => r.blockers)).toEqual(
      [],
    );
    // Pending members see existing shared fields and cannot save overrides
    // that acceptance would discard. A cleared description stays authoritative.
    const pending = "20000000-0000-4000-8000-000000000003";
    const project = "80000000-0000-4000-8000-000000000003";
    await raw.execute(sql`insert into submission_release_projects(id,owner_email,artist_name,title,artist_id,release_id,origin_submission_id)
      select ${project}::uuid,'artist@example.test','New Signal','Old project title',artist_id,${accepted.releaseId}::uuid,${id}::uuid from release_artist_credits where release_id=${accepted.releaseId}::uuid and position=1`);
    await client.exec(
      releaseSubmissionFixture(3)
        .replace("title, artist_details, status", "title, release_details, artist_details, status")
        .replace(
          "'Unwritten Frequency',",
          `'Unwritten Frequency', '{"kind":"album","albumProjectId":"${project}","trackNumber":2,"summary":"Old member description"}'::jsonb,`,
        ),
    );
    await raw.execute(
      sql`update releases set description=null where id=${accepted.releaseId}::uuid`,
    );
    const member = (await edits.find(pending))!;
    expect(member.fields.summary).toBe("");
    expect(member.releaseFieldsEditable).toBe(false);
    await expect(
      edits.save(
        pending,
        JSON.stringify(member.revision),
        { ...member.fields, releaseTitle: "Discarded override" },
        "Cannot change shared fields before acceptance",
        actor,
      ),
    ).rejects.toThrow();
    const memberSaved = (await edits.save(
      pending,
      JSON.stringify(member.revision),
      { ...member.fields, title: "Member correction" },
      "Track correction preserves release",
      actor,
    ))!;
    expect(memberSaved.fields.summary).toBe("");
    await createCurationWorkflowRepository(db).finalizeReview(
      {
        submissionId: pending,
        artisticQuality: 2,
        originalityIntent: 2,
        productionReadiness: 2,
        editorialFit: 2,
        finalGrade: "C",
        rationale: "Synthetic pending-member rejection for isolated verification.",
      },
      actor,
      new Date(),
    );
    const oldPublicationRevision = await publishing.publicationRevision(accepted.releaseId!);
    await edits.save(
      id,
      JSON.stringify((await edits.find(id))!.revision),
      { ...fields, title: "Updated after confirmation", summary: "" },
      "Corrected after a publishing confirmation",
      actor,
    );
    await expect(
      publishing.publish(
        accepted.releaseId!,
        actor,
        [decision!.resultingTrackId!],
        oldPublicationRevision,
      ),
    ).rejects.toThrow();
    const confirmation = await publishing.publicationRevision(accepted.releaseId!);
    const trackIds = [decision!.resultingTrackId!];
    const slug = await publishing.publish(accepted.releaseId!, actor, trackIds, confirmation);
    expect(await publishing.publish(accepted.releaseId!, actor, trackIds, confirmation)).toBe(slug);
    expect(
      (await client.query("select artwork_asset_id from track_artwork_assets")).rows[0],
    ).toEqual({ artwork_asset_id: artwork.id });
    expect(
      (
        await client.query(
          "select resulting_track_id,accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions where id='20000000-0000-4000-8000-000000000001'",
        )
      ).rows,
    ).toEqual(pins);
    expect((await delivery(`/media/artwork/${artwork.id}`)).status).toBe(307);
    expect((await delivery(signed)).status).toBe(200);
    const live = (await edits.find(id))!;
    expect(live).toMatchObject({ editable: false, discoveryEditable: true });
    const protectedTables = [
      "releases",
      "submissions",
      "curation_reviews",
      "rights_declarations",
      "creative_process_disclosures",
      "provenance_records",
      "audio_assets",
      "artwork_assets",
      "release_preparation_jobs",
      "track_artist_credits",
      "release_artist_credits",
      "track_artwork_assets",
      "release_artwork_assets",
    ];
    const protectedBefore = await Promise.all(
      protectedTables.map(
        async (table) =>
          (
            await client.query(
              `select to_jsonb(row) as value from ${table} row order by to_jsonb(row)::text`,
            )
          ).rows,
      ),
    );
    const trackBefore = (
      await client.query(
        "select to_jsonb(t)-array['genre','genres','moods','creative_process_tags','updated_at'] as value from tracks t where id=$1",
        [live.trackId],
      )
    ).rows;
    const corrections = {
      ...live.fields,
      genres: ["Electronic", "Ambient"],
      moods: ["Dreamy"],
      processTags: ["Human composition", "Mixing"],
    };
    const corrected = (await edits.save(
      id,
      JSON.stringify(live.revision),
      corrections,
      "Correct discovery details after publication",
      actor,
    ))!;
    expect(corrected.fields).toEqual(corrections);
    expect(corrected.revision).not.toEqual(live.revision);
    expect(
      (
        await client.query(
          "select genre,genres,moods,creative_process_tags from tracks where id=$1",
          [live.trackId],
        )
      ).rows,
    ).toEqual([
      {
        genre: "Electronic",
        genres: corrections.genres,
        moods: corrections.moods,
        creative_process_tags: corrections.processTags,
      },
    ]);
    expect(
      (
        await client.query(
          "select to_jsonb(t)-array['genre','genres','moods','creative_process_tags','updated_at'] as value from tracks t where id=$1",
          [live.trackId],
        )
      ).rows,
    ).toEqual(trackBefore);
    expect(
      await Promise.all(
        protectedTables.map(
          async (table) =>
            (
              await client.query(
                `select to_jsonb(row) as value from ${table} row order by to_jsonb(row)::text`,
              )
            ).rows,
        ),
      ),
    ).toEqual(protectedBefore);
    const correctionNote = (
      await client.query<{
        metadata: { previous: unknown; fields: unknown; previousRevision: unknown };
      }>(
        "select metadata from submission_activities where message='Correct discovery details after publication'",
      )
    ).rows[0];
    expect(correctionNote.metadata).toMatchObject({
      previous: live.fields,
      fields: corrections,
      previousRevision: live.revision,
    });
    expect(
      (
        await client.query(
          "select from_lifecycle,to_lifecycle,actor_id from publication_audit where reason='Curator submission details: Correct discovery details after publication'",
        )
      ).rows,
    ).toEqual([{ from_lifecycle: "published", to_lifecycle: "published", actor_id: actor.id }]);
    await expect(
      edits.save(
        id,
        JSON.stringify(live.revision),
        corrections,
        "Stale published correction",
        actor,
      ),
    ).rejects.toThrow();
    const noteCount = (await client.query("select count(*) from submission_activities")).rows;
    const auditCount = (await client.query("select count(*) from publication_audit")).rows;
    for (const changed of [
      { title: "Forged title" },
      { releaseTitle: "Forged release" },
      { summary: "Forged description" },
      { genres: [] },
      { moods: [] },
      { processTags: [] },
      { genres: ["Invented genre"] },
      { moods: ["Invented mood"] },
      { processTags: ["Invented process"] },
      { processTags: ["Mixing", "Mixing"] },
    ]) {
      await expect(
        edits.save(
          id,
          JSON.stringify(corrected.revision),
          { ...corrections, ...changed },
          "Forbidden published correction",
          actor,
        ),
      ).rejects.toThrow();
    }
    await expect(
      edits.save(
        id,
        JSON.stringify(corrected.revision),
        corrections,
        "Forbidden published cover",
        actor,
        { ...artwork, id: crypto.randomUUID() },
      ),
    ).rejects.toThrow();
    expect((await client.query("select count(*) from submission_activities")).rows).toEqual(
      noteCount,
    );
    expect((await client.query("select count(*) from publication_audit")).rows).toEqual(auditCount);
    expect((await edits.find(id))?.fields).toEqual(corrections);
    // Tag correction does not unpublish or break an idempotent completed retry.
    expect(await publishing.publish(accepted.releaseId!, actor, trackIds, confirmation)).toBe(slug);
    // Archived and rejected records remain closed.
    await client.exec("begin");
    await client.query(
      "update tracks set lifecycle_status='archived',archived_at=now() where id=$1",
      [live.trackId],
    );
    const archived = (await edits.find(id))!;
    expect(archived.discoveryEditable).toBe(false);
    await client.exec("rollback");
    expect((await edits.find(pending))?.discoveryEditable).toBe(false);
    // A legacy release-only target is closed even without a resulting track.
    await client.exec(releaseSubmissionFixture(2));
    const legacy = "20000000-0000-4000-8000-000000000002";
    await raw.execute(
      sql`update submissions set status='accepted',accepted_at=now(),resulting_release_id=${accepted.releaseId}::uuid,accepted_rights_declaration_id='30000000-0000-4000-8000-000000000002',accepted_creative_process_disclosure_id='40000000-0000-4000-8000-000000000002',accepted_provenance_record_id='50000000-0000-4000-8000-000000000002' where id=${legacy}::uuid`,
    );
    expect(await edits.find(legacy)).toMatchObject({ editable: false, discoveryEditable: false });
    await expect(
      raw.execute(
        sql`insert into submission_editorial_artwork(submission_id,artwork_asset_id) values(${legacy}::uuid,${artwork.id}::uuid)`,
      ),
    ).rejects.toThrow();
    await expect(
      edits.save(
        id,
        JSON.stringify((await edits.find(id))!.revision),
        fields,
        "Protected published titles cannot be changed here",
        actor,
      ),
    ).rejects.toThrow();
    expect(
      (
        await client.query(
          "select metadata->>'permissionConfirmed' as permission,actor_role from submission_activities where metadata->>'kind'='curator_artwork'",
        )
      ).rows,
    ).toEqual([{ permission: "true", actor_role: "curator" }]);
  } finally {
    await client.close();
  }
}, 30000);
