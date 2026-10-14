import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as schema from "../../app/db/schema";
import { createSubmissionRepository } from "../../app/repositories/submissions.server";

describe("production submission queue reads", () => {
  let client: PGlite;
  let repository: ReturnType<typeof createSubmissionRepository>;
  let queries: number;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client, { schema }), { migrationsFolder: "./drizzle" });
    await client.exec(`
      insert into submission_invitations (
        public_reference, token_hash, invitee_name, invitee_email, expires_at
      ) select 'INV-BATCH-' || n, repeat(md5(n::text), 2), 'Artist ' || n,
        'artist' || n || '@example.test', '2030-01-01'::timestamptz
        from generate_series(1, 26) n;
      insert into submissions (
        invitation_id, public_reference, invitation_reference, submitter_name,
        submitter_email, title, artist_details, updated_at
      ) select id, 'SUB-' || public_reference, public_reference, invitee_name,
        invitee_email, 'Track ' || split_part(public_reference, '-', 3), '{}'::jsonb,
        '2026-09-01'::timestamptz + split_part(public_reference, '-', 3)::int * interval '1 second'
        from submission_invitations;
      insert into rights_declarations (
        submission_id, version, revision_author_name, revision_author_email,
        revision_reason, authority_basis, entitlement_statement, public_summary
      ) select id, v, submitter_name, submitter_email, 'Version ' || v,
        'original_author', 'Controlled by ' || title, title || ' rights v' || v
        from submissions cross join generate_series(1, 1) v;
      insert into creative_process_disclosures (
        submission_id, version, revision_author_name, revision_author_email,
        revision_reason, ai_used, meaningful_human_contribution, artist_summary
      ) select id, v, submitter_name, submitter_email, 'Version ' || v,
        false, 'Composition by ' || title, title || ' process v' || v
        from submissions cross join generate_series(1, 1) v;
      insert into provenance_records (
        submission_id, version, revision_author_name, revision_author_email,
        revision_reason, summary
      ) select id, v, submitter_name, submitter_email, 'Version ' || v,
        title || ' provenance v' || v
        from submissions cross join generate_series(1, 1) v;
      insert into provenance_steps (provenance_record_id, position, process_type, description)
        select id, p, 'composition', summary || ' step ' || p
        from provenance_records cross join generate_series(1, 2) p;
      insert into provenance_sources (provenance_record_id, position, source_type, reference)
        select id, 1, 'other', summary || ' source' from provenance_records;
      insert into provenance_evidence (
        provenance_record_id, storage_provider, object_key, original_filename,
        mime_type, checksum_sha256, byte_size
      ) select id, 'r2', 'private/evidence/' || id, summary || '.txt',
        'text/plain', repeat('a', 64), 1024 from provenance_records;
      update rights_declarations set status = 'attested', attestation = 'Fixture rights', attested_at = now();
      update creative_process_disclosures set status = 'finalized', finalized_at = now();
      update provenance_records set status = 'finalized', finalized_at = now();
      insert into rights_declarations (
        submission_id, version, supersedes_id, revision_author_name, revision_author_email,
        revision_reason, authority_basis, entitlement_statement, public_summary
      ) select submission_id, 2, id, revision_author_name, revision_author_email,
        'New version', authority_basis, entitlement_statement, replace(public_summary, ' v1', ' v2')
        from rights_declarations where version = 1;
      insert into creative_process_disclosures (
        submission_id, version, supersedes_id, revision_author_name, revision_author_email,
        revision_reason, ai_used, meaningful_human_contribution, artist_summary
      ) select submission_id, 2, id, revision_author_name, revision_author_email,
        'New version', false, meaningful_human_contribution, replace(artist_summary, ' v1', ' v2')
        from creative_process_disclosures where version = 1;
      insert into provenance_records (
        submission_id, version, supersedes_id, revision_author_name, revision_author_email,
        revision_reason, summary
      ) select submission_id, 2, id, revision_author_name, revision_author_email,
        'New version', replace(summary, ' v1', ' v2') from provenance_records where version = 1;
      insert into provenance_steps (provenance_record_id, position, process_type, description)
        select id, p, 'composition', summary || ' step ' || p
        from provenance_records cross join generate_series(1, 2) p where version = 2;
      insert into provenance_sources (provenance_record_id, position, source_type, reference)
        select id, 1, 'other', summary || ' source' from provenance_records where version = 2;
      insert into provenance_evidence (
        provenance_record_id, storage_provider, object_key, original_filename,
        mime_type, checksum_sha256, byte_size
      ) select id, 'r2', 'private/evidence/' || id, summary || '.txt',
        'text/plain', repeat('a', 64), 1024 from provenance_records where version = 2;
      insert into submission_activities (submission_id, activity_type, actor_role, message, created_at)
        select id, 'note', 'curator', title || ' note ' || n,
        '2026-09-01'::timestamptz + n * interval '1 second'
        from submissions cross join generate_series(1, 2) n;
    `);
    queries = 0;
    const db = drizzle(client, {
      schema,
      logger: { logQuery: () => queries++ },
    });
    repository = createSubmissionRepository(db as never);
  }, 30_000);

  afterEach(async () => client.close());

  it("loads all 26 page rows with bounded queries and correctly associated latest disclosures", async () => {
    const rows = await repository.listCuratorSubmissions({ limit: 26 });
    expect(rows).toHaveLength(26);
    // Every query is a fetch with the production Neon HTTP driver. Leave room
    // below the Worker budget for authentication, counts and other route loaders.
    expect(queries).toBeLessThanOrEqual(10);
    expect(rows.map(({ submission }) => submission.title)).toEqual(
      Array.from({ length: 26 }, (_, index) => `Track ${26 - index}`),
    );
    for (const row of rows) {
      const title = row.submission.title;
      expect(row.invitation.inviteeEmail).toBe(row.submission.submitterEmail);
      expect(row.rights).toMatchObject({ version: 2, publicSummary: `${title} rights v2` });
      expect(row.process).toMatchObject({ version: 2, publicSummary: `${title} process v2` });
      expect(row.provenance).toMatchObject({
        version: 2,
        summary: `${title} provenance v2`,
        steps: [
          { position: 1, description: `${title} provenance v2 step 1` },
          { position: 2, description: `${title} provenance v2 step 2` },
        ],
        sources: [{ reference: `${title} provenance v2 source` }],
      });
      expect(row.evidence).toMatchObject([{ originalFilename: `${title} provenance v2.txt` }]);
      expect(row.activities.map(({ message }) => message)).toEqual([
        `${title} note 2`,
        `${title} note 1`,
      ]);
      expect(row.claimable).toBe(false);
    }
  });

  it("preserves search, pagination and the single-submission review lookup", async () => {
    const rows = await repository.listCuratorSubmissions({ query: "Track 2", limit: 2, offset: 1 });
    expect(rows.map(({ submission }) => submission.title)).toEqual(["Track 25", "Track 24"]);
    queries = 0;
    const selected = await repository.findCuratorSubmission(rows[1].submission.id);
    expect(selected?.provenance).toEqual(rows[1].provenance);
    expect(selected?.rights).toEqual(rows[1].rights);
    expect(selected?.evidence).toEqual(rows[1].evidence);
    expect(queries).toBeLessThanOrEqual(9);
  });

  it("returns empty and missing results without expanding unrelated submissions", async () => {
    expect(await repository.listCuratorSubmissions({ query: "missing track" })).toEqual([]);
    expect(queries).toBe(1);
    queries = 0;
    expect(
      await repository.findCuratorSubmission("00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
    expect(queries).toBe(1);
  });
});
