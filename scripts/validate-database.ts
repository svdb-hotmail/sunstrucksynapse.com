import { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import {
  artists,
  collectionItems,
  creativeProcessDisclosures,
  editorialCollections,
  provenanceRecords,
  releases,
  rightsDeclarations,
  submissions,
  trackArtistCredits,
  tracks,
} from "../app/db/schema";
import * as schema from "../app/db/schema";
import { seedDatabase, seedIds } from "./seed-data";

const expectedTables = [
  "artist_artwork_assets",
  "artists",
  "artwork_assets",
  "audio_assets",
  "collection_items",
  "creative_process_disclosures",
  "editorial_collections",
  "provenance_evidence",
  "provenance_records",
  "provenance_sources",
  "provenance_steps",
  "release_artist_credits",
  "release_artwork_assets",
  "releases",
  "rights_declarations",
  "submissions",
  "track_artist_credits",
  "tracks",
] as const;

const requiredIndexes = [
  "artists_slug_unique",
  "tracks_release_order_idx",
  "collection_items_collection_order_idx",
  "collection_items_track_unique",
  "collection_items_release_unique",
  "submissions_review_queue_idx",
  "rights_declarations_submission_version_unique",
  "rights_declarations_supersedes_unique",
  "creative_process_disclosures_supersedes_unique",
  "provenance_records_supersedes_unique",
] as const;

const requiredChecks = [
  "collection_items_exactly_one_target_check",
  "rights_declarations_parent_check",
  "rights_declarations_version_check",
  "rights_declarations_self_supersession_check",
  "creative_process_disclosures_parent_check",
  "provenance_records_parent_check",
] as const;

const requiredTriggers = [
  "artists_set_updated_at",
  "artwork_assets_set_updated_at",
  "audio_assets_set_updated_at",
  "releases_set_updated_at",
  "tracks_set_updated_at",
  "editorial_collections_set_updated_at",
  "creative_process_disclosures_set_updated_at",
  "provenance_records_set_updated_at",
  "rights_declarations_set_updated_at",
  "submissions_set_updated_at",
  "rights_declarations_enforce_supersession",
  "creative_process_disclosures_enforce_supersession",
  "provenance_records_enforce_supersession",
  "releases_require_artist_credit",
  "release_artist_credits_preserve_credit",
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Local database validation failed: ${message}`);
  }
}

async function expectRejection(label: string, operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`Local database validation failed: ${label} was accepted`);
}

async function readCounts(client: PGlite) {
  const counts: Record<string, number> = {};
  for (const table of expectedTables) {
    const result = await client.query<{ count: number }>(
      `select count(*)::integer as count from "${table}"`,
    );
    counts[table] = result.rows[0]?.count ?? -1;
  }
  return counts;
}

async function createMigratedDatabase() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { client, db };
}

async function verifySchemaObjects(client: PGlite) {
  const tableResult = await client.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  );
  const tableNames = tableResult.rows.map(({ tablename }) => tablename);
  assert(
    JSON.stringify(tableNames) === JSON.stringify([...expectedTables]),
    "the public table inventory does not match the committed schema",
  );

  const indexResult = await client.query<{ indexname: string }>(
    "select indexname from pg_indexes where schemaname = 'public'",
  );
  const indexNames = new Set(indexResult.rows.map(({ indexname }) => indexname));
  for (const indexName of requiredIndexes) {
    assert(indexNames.has(indexName), `required index ${indexName} is missing`);
  }

  const constraintResult = await client.query<{ name: string; type: string }>(
    `select conname as name, contype as type
     from pg_constraint
     where connamespace = 'public'::regnamespace`,
  );
  const constraints = new Map(
    constraintResult.rows.map(({ name, type }) => [name, type]),
  );
  for (const checkName of requiredChecks) {
    assert(constraints.get(checkName) === "c", `required check ${checkName} is missing`);
  }
  const foreignKeyCount = constraintResult.rows.filter(({ type }) => type === "f").length;
  assert(foreignKeyCount === 31, `expected 31 foreign keys, found ${foreignKeyCount}`);

  const triggerResult = await client.query<{ name: string }>(
    `select tgname as name
     from pg_trigger
     where not tgisinternal
     order by tgname`,
  );
  const triggerNames = new Set(triggerResult.rows.map(({ name }) => name));
  for (const triggerName of requiredTriggers) {
    assert(triggerNames.has(triggerName), `required trigger ${triggerName} is missing`);
  }
}

async function verifySeedRelations(
  db: ReturnType<typeof drizzle<typeof schema>>,
  client: PGlite,
) {
  const tracksWithCredits = await db
    .select({
      title: tracks.title,
      position: tracks.position,
      artist: artists.displayName,
    })
    .from(tracks)
    .innerJoin(trackArtistCredits, eq(trackArtistCredits.trackId, tracks.id))
    .innerJoin(artists, eq(artists.id, trackArtistCredits.artistId))
    .where(eq(tracks.releaseId, seedIds.release))
    .orderBy(asc(tracks.position));
  assert(
    tracksWithCredits.map(({ title }) => title).join("|") === "First Light|Quiet Circuit",
    "track ordering or artist-credit relation is incorrect",
  );
  assert(
    tracksWithCredits.every(({ artist }) => artist === "Synthetic Dawn Ensemble"),
    "track artist credits do not resolve to the seeded artist",
  );

  const collectionOrder = await db
    .select({
      position: collectionItems.position,
      trackId: collectionItems.trackId,
      releaseId: collectionItems.releaseId,
    })
    .from(collectionItems)
    .innerJoin(
      editorialCollections,
      eq(editorialCollections.id, collectionItems.collectionId),
    )
    .where(eq(editorialCollections.id, seedIds.collection))
    .orderBy(asc(collectionItems.position));
  assert(
    collectionOrder.length === 2 &&
      collectionOrder[0]?.releaseId === seedIds.release &&
      collectionOrder[1]?.trackId === seedIds.trackTwo,
    "editorial target relations or ordering are incorrect",
  );

  const submission = await db
    .select({
      status: submissions.status,
      releaseId: submissions.resultingReleaseId,
      releaseTitle: releases.title,
    })
    .from(submissions)
    .innerJoin(releases, eq(releases.id, submissions.resultingReleaseId))
    .where(eq(submissions.id, seedIds.submission));
  assert(
    submission[0]?.status === "accepted" &&
      submission[0]?.releaseId === seedIds.release &&
      submission[0]?.releaseTitle === "Signals Before Sunrise",
    "submission-to-catalogue relation is incorrect",
  );

  const [rightsVersions, disclosureVersions, provenanceVersions] = await Promise.all([
    db
      .select({ version: rightsDeclarations.version })
      .from(rightsDeclarations)
      .where(eq(rightsDeclarations.submissionId, seedIds.submission))
      .orderBy(asc(rightsDeclarations.version)),
    db
      .select({ version: creativeProcessDisclosures.version })
      .from(creativeProcessDisclosures)
      .where(eq(creativeProcessDisclosures.submissionId, seedIds.submission))
      .orderBy(asc(creativeProcessDisclosures.version)),
    db
      .select({ version: provenanceRecords.version })
      .from(provenanceRecords)
      .where(eq(provenanceRecords.submissionId, seedIds.submission))
      .orderBy(asc(provenanceRecords.version)),
  ]);
  for (const [name, versions] of [
    ["rights", rightsVersions],
    ["disclosure", disclosureVersions],
    ["provenance", provenanceVersions],
  ] as const) {
    assert(
      versions.map(({ version }) => version).join(",") === "1,2",
      `${name} version history is incomplete or unordered`,
    );
  }

  const before = await client.query<{ updated_at: Date }>(
    "select updated_at from artists where id = $1",
    [seedIds.artist],
  );
  await client.query("update artists set biography = biography || ' Updated.' where id = $1", [
    seedIds.artist,
  ]);
  const after = await client.query<{ updated_at: Date }>(
    "select updated_at from artists where id = $1",
    [seedIds.artist],
  );
  assert(
    new Date(after.rows[0]!.updated_at).getTime() >
      new Date(before.rows[0]!.updated_at).getTime(),
    "updated_at did not advance on a direct update",
  );
}

async function verifyConstraintRejections(client: PGlite) {
  const submissionB = "70000000-0000-4000-8000-000000000002";
  const rightsB1 = "80000000-0000-4000-8000-000000000010";
  await client.query(
    `insert into submissions (
       id, invitation_reference, submitter_name, submitter_email, title, status
     ) values ($1, 'seed-invitation-002', 'Second Artist', 'second@example.invalid',
       'Second Submission', 'draft')`,
    [submissionB],
  );
  await client.query(
    `insert into rights_declarations (
       id, submission_id, version, status, authority_basis,
       contains_third_party_material
     ) values ($1, $2, 1, 'draft', 'original_author', false)`,
    [rightsB1, submissionB],
  );

  await expectRejection("duplicate artist slug", () =>
    client.query(
      "insert into artists (slug, display_name) values ('synthetic-dawn-ensemble', 'Duplicate')",
    ),
  );
  await expectRejection("collection item with no target", () =>
    client.query(
      "insert into collection_items (collection_id, position) values ($1, 10)",
      [seedIds.collection],
    ),
  );
  await expectRejection("collection item with two targets", () =>
    client.query(
      `insert into collection_items (collection_id, track_id, release_id, position)
       values ($1, $2, $3, 10)`,
      [seedIds.collection, seedIds.trackOne, seedIds.release],
    ),
  );
  await expectRejection("duplicate collection position", () =>
    client.query(
      "insert into collection_items (collection_id, track_id, position) values ($1, $2, 1)",
      [seedIds.collection, seedIds.trackOne],
    ),
  );
  await expectRejection("duplicate declaration version", () =>
    client.query(
      `insert into rights_declarations (
         submission_id, version, status, authority_basis, contains_third_party_material
       ) values ($1, 2, 'draft', 'original_author', false)`,
      [seedIds.submission],
    ),
  );
  await expectRejection("self-supersession", () =>
    client.query(
      `insert into rights_declarations (
         id, submission_id, version, supersedes_id, status, authority_basis,
         contains_third_party_material
       ) values ('80000000-0000-4000-8000-000000000020', $1, 3,
         '80000000-0000-4000-8000-000000000020', 'draft', 'original_author', false)`,
      [seedIds.submission],
    ),
  );
  await expectRejection("cross-parent supersession", () =>
    client.query(
      `insert into rights_declarations (
         submission_id, version, supersedes_id, status, authority_basis,
         contains_third_party_material
       ) values ($1, 2, $2, 'draft', 'original_author', false)`,
      [submissionB, seedIds.rightsOne],
    ),
  );
  await client.query(
    `alter table rights_declarations disable trigger
       rights_declarations_enforce_supersession`,
  );
  await client.query(
    `insert into rights_declarations (
       id, submission_id, version, status, authority_basis,
       contains_third_party_material
     ) values ('80000000-0000-4000-8000-000000000030', $1, 4, 'draft',
       'original_author', false)`,
    [submissionB],
  );
  await client.query(
    `alter table rights_declarations enable trigger
       rights_declarations_enforce_supersession`,
  );
  await expectRejection("later or equal predecessor", () =>
    client.query(
      `insert into rights_declarations (
         submission_id, version, supersedes_id, status, authority_basis,
         contains_third_party_material
       ) values ($1, 2, '80000000-0000-4000-8000-000000000030', 'draft',
         'original_author', false)`,
      [submissionB],
    ),
  );
  await expectRejection("missing predecessor for later version", () =>
    client.query(
      `insert into rights_declarations (
         submission_id, version, status, authority_basis, contains_third_party_material
       ) values ($1, 2, 'draft', 'original_author', false)`,
      [submissionB],
    ),
  );
  await expectRejection("branched supersession", () =>
    client.query(
      `insert into rights_declarations (
         id, submission_id, version, supersedes_id, status, authority_basis,
         contains_third_party_material
       ) values ('80000000-0000-4000-8000-000000000021', $1, 2, $2,
         'draft', 'original_author', false)`,
      [seedIds.submission, seedIds.rightsOne],
    ),
  );
  await client.query(
    `insert into creative_process_disclosures (
       id, submission_id, version, status, ai_used, meaningful_human_contribution,
       tools_and_systems, artist_summary
     ) values ('90000000-0000-4000-8000-000000000010', $1, 1, 'draft', false,
       'Human-authored work.', '{}', 'Synthetic disclosure.')`,
    [submissionB],
  );
  await expectRejection("creative disclosure cross-parent supersession", () =>
    client.query(
      `insert into creative_process_disclosures (
         submission_id, version, supersedes_id, status, ai_used,
         meaningful_human_contribution, tools_and_systems, artist_summary
       ) values ($1, 2, $2, 'draft', false, 'Human-authored work.', '{}',
         'Synthetic disclosure.')`,
      [submissionB, seedIds.disclosureOne],
    ),
  );
  await client.query(
    `insert into provenance_records (
       id, submission_id, version, status, summary
     ) values ('a0000000-0000-4000-8000-000000000010', $1, 1, 'draft',
       'Synthetic provenance.')`,
    [submissionB],
  );
  await expectRejection("provenance missing predecessor", () =>
    client.query(
      `insert into provenance_records (
         submission_id, version, status, summary
       ) values ($1, 2, 'draft', 'Missing predecessor.')`,
      [submissionB],
    ),
  );
  await expectRejection("deleting governance history", () =>
    client.query("delete from rights_declarations where id = $1", [seedIds.rightsTwo]),
  );
  await expectRejection("changing finalized governance history", () =>
    client.query(
      "update rights_declarations set restrictions = 'Rewritten.' where id = $1",
      [seedIds.rightsTwo],
    ),
  );
  await client.query(
    "update rights_declarations set restrictions = 'Draft update.' where id = $1",
    [rightsB1],
  );
  await expectRejection("removing the final release artist credit", () =>
    client.query("delete from release_artist_credits where release_id = $1", [
      seedIds.release,
    ]),
  );
}

async function validateFirstDatabase() {
  const { client, db } = await createMigratedDatabase();
  try {
    const versionResult = await client.query<{ version: string }>("select version()");
    console.log(`PGlite select version(): ${versionResult.rows[0]?.version ?? "unknown"}`);
    await verifySchemaObjects(client);
    await seedDatabase(db);
    const firstCounts = await readCounts(client);
    await seedDatabase(db);
    const secondCounts = await readCounts(client);
    assert(
      JSON.stringify(firstCounts) === JSON.stringify(secondCounts),
      "running the shared seed twice changed row counts",
    );
    await verifySeedRelations(db, client);
    await verifyConstraintRejections(client);
    return firstCounts;
  } finally {
    await client.close();
  }
}

async function validateFreshReset(expectedCounts: Record<string, number>) {
  const { client, db } = await createMigratedDatabase();
  try {
    await seedDatabase(db);
    const resetCounts = await readCounts(client);
    assert(
      JSON.stringify(resetCounts) === JSON.stringify(expectedCounts),
      "fresh migration and seed reset produced different row counts",
    );
  } finally {
    await client.close();
  }
}

async function validateExistingHistoryGuard() {
  const client = new PGlite();
  try {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    assert(migrations.length === 2, "expected the original and forward migrations");
    for (const statement of migrations[0]!.sql) {
      await client.exec(statement);
    }
    await client.query(
      `insert into submissions (
         id, invitation_reference, submitter_name, submitter_email, title, status
       ) values ('70000000-0000-4000-8000-000000000099', 'invalid-history',
         'Invalid History', 'invalid@example.invalid', 'Invalid History', 'draft')`,
    );
    await client.query(
      `insert into rights_declarations (
         submission_id, version, status, authority_basis, contains_third_party_material
       ) values ('70000000-0000-4000-8000-000000000099', 2, 'draft',
         'original_author', false)`,
    );
    await expectRejection("forward migration over invalid existing history", async () => {
      for (const statement of migrations[1]!.sql) {
        await client.exec(statement);
      }
    });
  } finally {
    await client.close();
  }
}

try {
  await validateExistingHistoryGuard();
  const expectedCounts = await validateFirstDatabase();
  await validateFreshReset(expectedCounts);
  console.log(
    "Local PGlite validation passed: migration, schema objects, shared seed idempotence, relations, ordering, constraints, timestamps, and fresh reset.",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown validation failure";
  console.error(message);
  process.exitCode = 1;
}
