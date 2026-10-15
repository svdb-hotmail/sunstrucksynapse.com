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
import { STREAMING_PROFILE } from "../../app/config/music-metadata";

it("edits a legacy submission, preserves accepted evidence, and publishes with curator artwork", async () => {
  const client = new PGlite();
  try {
    const raw = drizzle(client, { schema });
    await migrate(raw, { migrationsFolder: "./drizzle" });
    const adapter = Object.create(raw);
    adapter.batch = async (queries: Promise<unknown>[]) => {
      await client.exec("begin");
      try {
        const results = [];
        for (const query of queries) results.push(await query);
        await client.exec("commit");
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
        "select resulting_track_id,accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions",
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
    expect(
      (await client.query("select status,cover_id from release_preparation_jobs")).rows,
    ).toEqual([{ status: "ready", cover_id: null }]);
    expect((await publishing.readiness(accepted.releaseId!)).flatMap((r) => r.blockers)).toEqual(
      [],
    );
    const oldPublicationRevision = await publishing.publicationRevision(accepted.releaseId!);
    await edits.save(
      id,
      JSON.stringify(withCover.revision),
      { ...fields, title: "Updated after confirmation" },
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
    const slug = await publishing.publish(accepted.releaseId!, actor);
    expect(await publishing.publish(accepted.releaseId!, actor)).toBe(slug);
    expect(
      (await client.query("select artwork_asset_id from track_artwork_assets")).rows[0],
    ).toEqual({ artwork_asset_id: artwork.id });
    expect(
      (
        await client.query(
          "select resulting_track_id,accepted_rights_declaration_id,accepted_creative_process_disclosure_id,accepted_provenance_record_id from submissions",
        )
      ).rows,
    ).toEqual(pins);
    expect((await edits.find(id))?.editable).toBe(false);
    await expect(
      edits.save(
        id,
        JSON.stringify((await edits.find(id))!.revision),
        fields,
        "Published metadata cannot be changed here",
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
