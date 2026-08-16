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
import {
  createCatalogueRepository,
  loadPublicCatalogue,
} from "../app/repositories/catalogue.server";
import { buildCatalogueSections } from "../app/services/catalogue";
import { seedDatabase, seedIds } from "./seed-data";

const expectedTables = [
  "artist_artwork_assets",
  "artists",
  "artwork_assets",
  "audio_assets",
  "collection_items",
  "creative_process_disclosures",
  "editorial_collections",
  "evidence_upload_sessions",
  "provenance_evidence",
  "provenance_evidence_access_audit",
  "provenance_evidence_access_grants",
  "provenance_records",
  "provenance_sources",
  "provenance_steps",
  "publication_audit",
  "release_artist_credits",
  "release_artwork_assets",
  "releases",
  "rights_declarations",
  "submission_activities",
  "submission_invitations",
  "submissions",
  "track_artist_credits",
  "track_artwork_assets",
  "tracks",
  "upload_sessions",
  "video_assets",
] as const;

const requiredIndexes = [
  "artists_slug_unique",
  "tracks_release_order_idx",
  "track_artwork_assets_track_id_idx",
  "video_assets_track_id_idx",
  "collection_items_collection_order_idx",
  "collection_items_track_unique",
  "collection_items_release_unique",
  "submissions_review_queue_idx",
  "submissions_public_reference_unique",
  "rights_declarations_submission_version_unique",
  "rights_declarations_supersedes_unique",
  "creative_process_disclosures_supersedes_unique",
  "publication_audit_entity_history_idx",
  "submission_invitations_public_reference_unique",
  "submission_activities_submission_created_idx",
  "evidence_upload_sessions_cleanup_idx",
  "provenance_evidence_record_storage_ref_unique",
  "provenance_records_supersedes_unique",
  "upload_sessions_cleanup_idx",
] as const;

const requiredChecks = [
  "artwork_assets_dimensions_check",
  "audio_assets_mime_type_check",
  "collection_items_exactly_one_target_check",
  "editorial_collections_homepage_config_check",
  "rights_declarations_parent_check",
  "rights_declarations_version_check",
  "rights_declarations_self_supersession_check",
  "creative_process_disclosures_parent_check",
  "creative_process_disclosures_revision_author_check",
  "provenance_records_parent_check",
  "provenance_records_revision_author_check",
  "provenance_evidence_filename_check",
  "submissions_resulting_catalogue_check",
  "submissions_acceptance_pins_check",
  "upload_sessions_metadata_check",
  "upload_sessions_state_check",
  "video_assets_mime_type_check",
] as const;

const requiredTriggers = [
  "artists_set_updated_at",
  "artwork_assets_set_updated_at",
  "audio_assets_set_updated_at",
  "video_assets_set_updated_at",
  "releases_set_updated_at",
  "tracks_set_updated_at",
  "editorial_collections_set_updated_at",
  "creative_process_disclosures_set_updated_at",
  "provenance_records_set_updated_at",
  "rights_declarations_set_updated_at",
  "submissions_set_updated_at",
  "submission_invitations_set_updated_at",
  "evidence_upload_sessions_set_updated_at",
  "rights_declarations_enforce_supersession",
  "creative_process_disclosures_enforce_supersession",
  "provenance_records_enforce_supersession",
  "provenance_steps_require_draft",
  "provenance_sources_require_draft",
  "provenance_evidence_require_draft",
  "releases_require_artist_credit",
  "release_artist_credits_lock_release",
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
  const constraints = new Map(constraintResult.rows.map(({ name, type }) => [name, type]));
  for (const checkName of requiredChecks) {
    assert(constraints.get(checkName) === "c", `required check ${checkName} is missing`);
  }
  const foreignKeyCount = constraintResult.rows.filter(({ type }) => type === "f").length;
  assert(foreignKeyCount === 44, `expected 44 foreign keys, found ${foreignKeyCount}`);

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

  const creditLockTrigger = await client.query<{ definition: string }>(
    `select pg_get_triggerdef(oid) as definition
     from pg_trigger
     where tgname = 'release_artist_credits_lock_release'`,
  );
  const creditLockDefinition = creditLockTrigger.rows[0]?.definition ?? "";
  assert(
    creditLockDefinition.includes("BEFORE") &&
      creditLockDefinition.includes("UPDATE") &&
      creditLockDefinition.includes("DELETE") &&
      creditLockDefinition.includes("FOR EACH ROW"),
    "release artist credit mutations are not locked before each row change",
  );
  const creditLockFunction = await client.query<{ definition: string }>(
    `select pg_get_functiondef('lock_release_artist_credit_mutation()'::regprocedure)
       as definition`,
  );
  assert(
    creditLockFunction.rows[0]?.definition.includes("FOR UPDATE"),
    "release artist credit mutation trigger does not lock its parent release",
  );
}

async function verifySeedRelations(db: ReturnType<typeof drizzle<typeof schema>>, client: PGlite) {
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

  const audioMimeTypes = await client.query<{ mime_type: string }>(
    "select mime_type from audio_assets",
  );
  assert(
    audioMimeTypes.rows.every(({ mime_type }) => mime_type.startsWith("audio/")),
    "audio assets contain non-audio media",
  );
  const videoMimeTypes = await client.query<{ mime_type: string }>(
    "select mime_type from video_assets",
  );
  assert(
    videoMimeTypes.rows.length === 3 &&
      videoMimeTypes.rows.every(({ mime_type }) => mime_type.startsWith("video/")),
    "video assets do not contain the three production videos",
  );

  const collectionOrder = await db
    .select({
      position: collectionItems.position,
      trackId: collectionItems.trackId,
      releaseId: collectionItems.releaseId,
    })
    .from(collectionItems)
    .innerJoin(editorialCollections, eq(editorialCollections.id, collectionItems.collectionId))
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
      .select({
        version: rightsDeclarations.version,
        status: rightsDeclarations.status,
        supersedesId: rightsDeclarations.supersedesId,
      })
      .from(rightsDeclarations)
      .where(eq(rightsDeclarations.submissionId, seedIds.submission))
      .orderBy(asc(rightsDeclarations.version)),
    db
      .select({
        version: creativeProcessDisclosures.version,
        status: creativeProcessDisclosures.status,
        supersedesId: creativeProcessDisclosures.supersedesId,
      })
      .from(creativeProcessDisclosures)
      .where(eq(creativeProcessDisclosures.submissionId, seedIds.submission))
      .orderBy(asc(creativeProcessDisclosures.version)),
    db
      .select({
        version: provenanceRecords.version,
        status: provenanceRecords.status,
        supersedesId: provenanceRecords.supersedesId,
      })
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
    assert(
      versions[0]?.status === "superseded" &&
        (versions[1]?.status === "attested" || versions[1]?.status === "finalized") &&
        versions[1]?.supersedesId ===
          (name === "rights"
            ? seedIds.rightsOne
            : name === "disclosure"
              ? seedIds.disclosureOne
              : seedIds.provenanceOne),
      `${name} seed did not exercise the finalized successor lifecycle`,
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
    new Date(after.rows[0]!.updated_at).getTime() > new Date(before.rows[0]!.updated_at).getTime(),
    "updated_at did not advance on a direct update",
  );
}

async function insertDraftSubmissionFixture(
  client: PGlite,
  submissionId: string,
  invitationReference: string,
  submitterName: string,
  submitterEmail: string,
  title: string,
  status: string = "draft",
) {
  const suffix = submissionId.replace(/-/g, "").slice(-12);
  const tokenHash = suffix.repeat(6).slice(0, 64);
  const invitationId = crypto.randomUUID();
  await client.query(
    `insert into submission_invitations (
       id, public_reference, token_hash, invitee_name, invitee_email, expires_at
     ) values ($1, $2, $3, $4, $5, clock_timestamp() + interval '1 day')`,
    [invitationId, `INV-${suffix}`, tokenHash, submitterName, submitterEmail],
  );
  await client.query(
    `insert into submissions (
       id, invitation_id, public_reference, invitation_reference, submission_kind,
       submitter_name, submitter_email, title, status
     ) values ($1, $2, $3, $4, 'track', $5, $6, $7, $8)`,
    [
      submissionId,
      invitationId,
      `SUB-${suffix}`,
      invitationReference,
      submitterName,
      submitterEmail,
      title,
      status,
    ],
  );
}

async function verifyGovernanceLifecycles(client: PGlite) {
  const cases = [
    {
      name: "rights declaration",
      table: "rights_declarations",
      submissionId: "70000000-0000-4000-8000-000000000003",
      versionOneId: "80000000-0000-4000-8000-000000000100",
      versionTwoId: "80000000-0000-4000-8000-000000000101",
      finalStatus: "attested",
      insertVersionOne: `insert into rights_declarations (
        id, submission_id, version, status, revision_author_name, revision_author_email,
        revision_reason, authority_basis, entitlement_statement, public_summary,
        contains_third_party_material
      ) values ($1, $2, 1, 'draft', 'Lifecycle Artist', 'lifecycle@example.invalid',
        'Lifecycle test', 'original_author', 'Lifecycle entitlement', 'Lifecycle public summary',
        false)`,
      insertVersionTwo: `insert into rights_declarations (
        id, submission_id, version, supersedes_id, status, revision_author_name,
        revision_author_email, revision_reason, authority_basis, entitlement_statement,
        public_summary, contains_third_party_material
      ) values ($1, $2, 2, $3, 'draft', 'Lifecycle Artist', 'lifecycle@example.invalid',
        'Lifecycle revision', 'original_author', 'Lifecycle entitlement',
        'Lifecycle public summary', false)`,
      finalizeVersion: `update rights_declarations
        set status = 'attested', attestation = 'Lifecycle test attestation',
            attested_at = clock_timestamp()
        where id = $1`,
      supersedeDraft: `update rights_declarations
        set status = 'superseded', attestation = 'Premature',
            attested_at = clock_timestamp()
        where id = $1`,
      mutateFinalized: `update rights_declarations
        set restrictions = 'Rewritten finalized content'
        where id = $1`,
    },
    {
      name: "creative-process disclosure",
      table: "creative_process_disclosures",
      submissionId: "70000000-0000-4000-8000-000000000004",
      versionOneId: "90000000-0000-4000-8000-000000000100",
      versionTwoId: "90000000-0000-4000-8000-000000000101",
      finalStatus: "finalized",
      insertVersionOne: `insert into creative_process_disclosures (
        id, submission_id, version, status, revision_author_name, revision_author_email,
        revision_reason, ai_used, meaningful_human_contribution, tools_and_systems,
        artist_summary
      ) values ($1, $2, 1, 'draft', 'Lifecycle Artist', 'lifecycle@example.invalid',
        'Lifecycle test', false, 'Human lifecycle contribution', '{}',
        'Lifecycle disclosure')`,
      insertVersionTwo: `insert into creative_process_disclosures (
        id, submission_id, version, supersedes_id, status, revision_author_name,
        revision_author_email, revision_reason, ai_used, meaningful_human_contribution,
        tools_and_systems, artist_summary
      ) values ($1, $2, 2, $3, 'draft', 'Lifecycle Artist', 'lifecycle@example.invalid',
        'Lifecycle revision', false, 'Human lifecycle contribution', '{}',
        'Lifecycle disclosure revision')`,
      finalizeVersion: `update creative_process_disclosures
        set status = 'finalized', finalized_at = clock_timestamp()
        where id = $1`,
      supersedeDraft: `update creative_process_disclosures
        set status = 'superseded', finalized_at = clock_timestamp()
        where id = $1`,
      mutateFinalized: `update creative_process_disclosures
        set artist_summary = 'Rewritten finalized content'
        where id = $1`,
    },
    {
      name: "provenance record",
      table: "provenance_records",
      submissionId: "70000000-0000-4000-8000-000000000005",
      versionOneId: "a0000000-0000-4000-8000-000000000100",
      versionTwoId: "a0000000-0000-4000-8000-000000000101",
      finalStatus: "finalized",
      insertVersionOne: `insert into provenance_records (
        id, submission_id, version, status, revision_author_name, revision_author_email,
        revision_reason, summary
      ) values ($1, $2, 1, 'draft', 'Lifecycle Artist', 'lifecycle@example.invalid',
        'Lifecycle test', 'Lifecycle provenance')`,
      insertVersionTwo: `insert into provenance_records (
        id, submission_id, version, supersedes_id, status, revision_author_name,
        revision_author_email, revision_reason, summary
      ) values ($1, $2, 2, $3, 'draft', 'Lifecycle Artist', 'lifecycle@example.invalid',
        'Lifecycle revision', 'Lifecycle provenance revision')`,
      finalizeVersion: `update provenance_records
        set status = 'finalized', finalized_at = clock_timestamp()
        where id = $1`,
      supersedeDraft: `update provenance_records
        set status = 'superseded', finalized_at = clock_timestamp()
        where id = $1`,
      mutateFinalized: `update provenance_records
        set summary = 'Rewritten finalized content'
        where id = $1`,
    },
  ] as const;

  for (const lifecycle of cases) {
    await insertDraftSubmissionFixture(
      client,
      lifecycle.submissionId,
      `lifecycle-${lifecycle.name}`,
      "Lifecycle Artist",
      "lifecycle@example.invalid",
      "Lifecycle Test",
    );
    await client.query(lifecycle.insertVersionOne, [
      lifecycle.versionOneId,
      lifecycle.submissionId,
    ]);
    await expectRejection(`${lifecycle.name} direct draft supersession`, () =>
      client.query(lifecycle.supersedeDraft, [lifecycle.versionOneId]),
    );
    await expectRejection(`${lifecycle.name} successor from draft predecessor`, () =>
      client.query(lifecycle.insertVersionTwo, [
        lifecycle.versionTwoId,
        lifecycle.submissionId,
        lifecycle.versionOneId,
      ]),
    );

    await client.query(lifecycle.finalizeVersion, [lifecycle.versionOneId]);
    const finalizedOne = await client.query<{ status: string }>(
      `select status::text as status from "${lifecycle.table}" where id = $1`,
      [lifecycle.versionOneId],
    );
    assert(
      finalizedOne.rows[0]?.status === lifecycle.finalStatus,
      `${lifecycle.name} version 1 did not finalize`,
    );

    await client.query(lifecycle.insertVersionTwo, [
      lifecycle.versionTwoId,
      lifecycle.submissionId,
      lifecycle.versionOneId,
    ]);
    const draftSuccessor = await client.query<{ id: string; status: string }>(
      `select id, status::text as status
       from "${lifecycle.table}"
       where id in ($1, $2)
       order by version`,
      [lifecycle.versionOneId, lifecycle.versionTwoId],
    );
    assert(
      draftSuccessor.rows[0]?.status === lifecycle.finalStatus &&
        draftSuccessor.rows[1]?.status === "draft",
      `${lifecycle.name} draft successor changed its current predecessor`,
    );

    await client.query(lifecycle.finalizeVersion, [lifecycle.versionTwoId]);
    const finalizedSuccessor = await client.query<{ id: string; status: string }>(
      `select id, status::text as status
       from "${lifecycle.table}"
       where id in ($1, $2)
       order by version`,
      [lifecycle.versionOneId, lifecycle.versionTwoId],
    );
    assert(
      finalizedSuccessor.rows[0]?.status === "superseded" &&
        finalizedSuccessor.rows[1]?.status === lifecycle.finalStatus,
      `${lifecycle.name} finalization did not atomically supersede its predecessor`,
    );
    await expectRejection(`${lifecycle.name} finalized content mutation`, () =>
      client.query(lifecycle.mutateFinalized, [lifecycle.versionTwoId]),
    );
    await expectRejection(`${lifecycle.name} deletion`, () =>
      client.query(`delete from "${lifecycle.table}" where id = $1`, [lifecycle.versionTwoId]),
    );
  }

  await expectRejection("finalized provenance step insertion", () =>
    client.query(
      `insert into provenance_steps (
         provenance_record_id, position, process_type, description
       ) values ($1, 2, 'rewrite', 'Post-finalization rewrite')`,
      [seedIds.provenanceTwo],
    ),
  );
  await expectRejection("finalized provenance source update", () =>
    client.query("update provenance_sources set reference = 'Rewritten source' where id = $1", [
      seedIds.provenanceSource,
    ]),
  );
  await expectRejection("finalized provenance evidence deletion", () =>
    client.query("delete from provenance_evidence where id = $1", [seedIds.provenanceEvidence]),
  );
}

async function verifyConstraintRejections(client: PGlite) {
  const submissionB = "70000000-0000-4000-8000-000000000002";
  const rightsB1 = "80000000-0000-4000-8000-000000000010";
  await insertDraftSubmissionFixture(
    client,
    submissionB,
    "seed-invitation-002",
    "Second Artist",
    "second@example.invalid",
    "Second Submission",
  );
  await client.query(
    `insert into rights_declarations (
       id, submission_id, version, status, revision_author_name, revision_author_email,
       revision_reason, authority_basis, entitlement_statement, public_summary,
       contains_third_party_material
     ) values ($1, $2, 1, 'draft', 'Second Artist', 'second@example.invalid',
       'Constraint fixture', 'original_author', 'Constraint entitlement',
       'Constraint public summary', false)`,
    [rightsB1, submissionB],
  );

  await expectRejection("duplicate artist slug", () =>
    client.query(
      "insert into artists (slug, display_name) values ('synthetic-dawn-ensemble', 'Duplicate')",
    ),
  );
  await client.query(
    `insert into artwork_assets (
       object_key, scope, mime_type, checksum_sha256, byte_size, width, height
     ) values ('artwork/test/no-dimensions.webp', 'publishable_derivative', 'image/webp',
       repeat('a', 64), 100, null, null),
       ('artwork/test/positive-dimensions.webp', 'publishable_derivative', 'image/webp',
       repeat('b', 64), 100, 320, 180)`,
  );
  await expectRejection("artwork with width but no height", () =>
    client.query(
      `insert into artwork_assets (
         object_key, scope, mime_type, checksum_sha256, byte_size, width
       ) values ('artwork/test/missing-height.webp', 'publishable_derivative', 'image/webp',
         repeat('c', 64), 100, 320)`,
    ),
  );
  await expectRejection("artwork with non-positive dimensions", () =>
    client.query(
      `insert into artwork_assets (
         object_key, scope, mime_type, checksum_sha256, byte_size, width, height
       ) values ('artwork/test/zero-width.webp', 'publishable_derivative', 'image/webp',
         repeat('d', 64), 100, 0, 180)`,
    ),
  );
  await expectRejection("collection item with no target", () =>
    client.query("insert into collection_items (collection_id, position) values ($1, 10)", [
      seedIds.collection,
    ]),
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
    client.query("update rights_declarations set restrictions = 'Rewritten.' where id = $1", [
      seedIds.rightsTwo,
    ]),
  );
  await client.query(
    "update rights_declarations set restrictions = 'Draft update.' where id = $1",
    [rightsB1],
  );
  const acceptedNoTarget = "70000000-0000-4000-8000-000000000020";
  const acceptedRights = "80000000-0000-4000-8000-000000000021";
  const acceptedDisclosure = "90000000-0000-4000-8000-000000000021";
  const acceptedProvenance = "a0000000-0000-4000-8000-000000000021";
  await insertDraftSubmissionFixture(
    client,
    acceptedNoTarget,
    "accepted-without-target",
    "Accepted Artist",
    "accepted@example.invalid",
    "Accepted without target",
  );
  await client.query(
    `insert into rights_declarations (
       id, submission_id, version, status, revision_author_name, revision_author_email,
       revision_reason, authority_basis, entitlement_statement, public_summary,
       contains_third_party_material
     ) values ($1, $2, 1, 'draft', 'Accepted Artist', 'accepted@example.invalid',
       'Accepted fixture', 'original_author', 'Accepted entitlement',
       'Accepted public summary', false)`,
    [acceptedRights, acceptedNoTarget],
  );
  await client.query(
    `insert into creative_process_disclosures (
       id, submission_id, version, status, revision_author_name, revision_author_email,
       revision_reason, ai_used, meaningful_human_contribution, tools_and_systems,
       artist_summary
     ) values ($1, $2, 1, 'draft', 'Accepted Artist', 'accepted@example.invalid',
       'Accepted fixture', false, 'Accepted human contribution', '{}',
       'Accepted disclosure')`,
    [acceptedDisclosure, acceptedNoTarget],
  );
  await client.query(
    `insert into provenance_records (
       id, submission_id, version, status, revision_author_name, revision_author_email,
       revision_reason, summary
     ) values ($1, $2, 1, 'draft', 'Accepted Artist', 'accepted@example.invalid',
       'Accepted fixture', 'Accepted provenance')`,
    [acceptedProvenance, acceptedNoTarget],
  );
  await client.query(
    `update rights_declarations
     set status = 'attested', attestation = 'Accepted attestation', attested_at = clock_timestamp()
     where id = $1`,
    [acceptedRights],
  );
  await client.query(
    `update creative_process_disclosures
     set status = 'finalized', finalized_at = clock_timestamp()
     where id = $1`,
    [acceptedDisclosure],
  );
  await client.query(
    `update provenance_records
     set status = 'finalized', finalized_at = clock_timestamp()
     where id = $1`,
    [acceptedProvenance],
  );
  await client.query(
    `update submissions
     set status = 'accepted', submitted_at = clock_timestamp(), reviewed_at = clock_timestamp(),
         accepted_at = clock_timestamp(), accepted_rights_declaration_id = $2,
         accepted_creative_process_disclosure_id = $3, accepted_provenance_record_id = $4
     where id = $1`,
    [acceptedNoTarget, acceptedRights, acceptedDisclosure, acceptedProvenance],
  );
  await client.query(
    `insert into submission_invitations (
       id, public_reference, token_hash, invitee_name, invitee_email, expires_at
     ) values
       ('6f000000-0000-4000-8000-000000000021', 'INV-AMBIGUOUS', repeat('8', 64), 'Ambiguous Artist', 'ambiguous@example.invalid', clock_timestamp() + interval '1 day'),
       ('6f000000-0000-4000-8000-000000000022', 'INV-DRAFT-TARGET', repeat('7', 64), 'Draft Artist', 'draft@example.invalid', clock_timestamp() + interval '1 day')`,
  );
  await expectRejection("accepted submission with both catalogue targets", () =>
    client.query(
      `insert into submissions (
         id, invitation_id, public_reference, invitation_reference, submission_kind,
         submitter_name, submitter_email, title, status, submitted_at, reviewed_at,
         accepted_at, accepted_rights_declaration_id, accepted_creative_process_disclosure_id,
         accepted_provenance_record_id, resulting_release_id, resulting_track_id
       ) values (
         '70000000-0000-4000-8000-000000000021',
         '6f000000-0000-4000-8000-000000000021',
         'SUB-AMBIGUOUS',
         'ambiguous-target',
         'track',
         'Ambiguous Artist',
         'ambiguous@example.invalid',
         'Ambiguous target',
         'accepted',
         clock_timestamp(),
         clock_timestamp(),
         clock_timestamp(),
         $3,
         $4,
         $5,
         $1,
         $2
       )`,
      [seedIds.release, seedIds.trackOne, acceptedRights, acceptedDisclosure, acceptedProvenance],
    ),
  );
  await expectRejection("non-accepted submission with a catalogue target", () =>
    client.query(
      `insert into submissions (
         id, invitation_id, public_reference, invitation_reference, submission_kind,
         submitter_name, submitter_email, title, status, submitted_at, resulting_release_id
       ) values (
         '70000000-0000-4000-8000-000000000022',
         '6f000000-0000-4000-8000-000000000022',
         'SUB-DRAFT-TARGET',
         'draft-with-target',
         'release',
         'Draft Artist',
         'draft@example.invalid',
         'Draft target',
         'received',
         clock_timestamp(),
         $1
       )`,
      [seedIds.release],
    ),
  );
  await client.query(
    `insert into artists (id, slug, display_name)
     values ('20000000-0000-4000-8000-000000000002', 'second-credit', 'Second Credit')`,
  );
  await client.query(
    `insert into release_artist_credits (release_id, artist_id, position)
     values ($1, '20000000-0000-4000-8000-000000000002', 2)`,
    [seedIds.release],
  );
  await client.query(
    `delete from release_artist_credits
     where release_id = $1 and artist_id = '20000000-0000-4000-8000-000000000002'`,
    [seedIds.release],
  );
  await expectRejection("removing the final release artist credit", () =>
    client.query("delete from release_artist_credits where release_id = $1", [seedIds.release]),
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
    await verifyGovernanceLifecycles(client);
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
    assert(migrations.length === 7, "expected the original and six forward migrations");
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
         id, submission_id, version, status, authority_basis,
         contains_third_party_material
       ) values ('80000000-0000-4000-8000-000000000199',
         '70000000-0000-4000-8000-000000000099', 1, 'draft',
         'original_author', false)`,
    );
    await client.query(
      `insert into rights_declarations (
         submission_id, version, supersedes_id, status, authority_basis,
         contains_third_party_material, attestation, attested_at
       ) values ('70000000-0000-4000-8000-000000000099', 2,
         '80000000-0000-4000-8000-000000000199', 'attested',
         'original_author', false, 'Invalid lifecycle history', clock_timestamp())`,
    );
    await expectRejection(
      "forward migration over finalized successor with draft predecessor",
      async () => {
        for (const statement of migrations[1]!.sql) {
          await client.exec(statement);
        }
      },
    );
  } finally {
    await client.close();
  }
}

async function validateVideoAssetForwardMigration() {
  const client = new PGlite();
  try {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    assert(migrations.length === 7, "expected the original and six forward migrations");
    for (const migration of migrations.slice(0, 4)) {
      for (const statement of migration.sql) {
        await client.exec(statement);
      }
    }
    await client.exec(`
      insert into artists (
        id, slug, display_name
      ) values (
        '10000000-0000-4000-8000-000000000901',
        'migration-artist',
        'Migration Artist'
      );
      insert into releases (
        id, slug, title
      ) values (
        '20000000-0000-4000-8000-000000000901',
        'migration-release',
        'Migration Release'
      );
      insert into release_artist_credits (
        release_id, artist_id, position
      ) values (
        '20000000-0000-4000-8000-000000000901',
        '10000000-0000-4000-8000-000000000901',
        1
      );
      insert into tracks (
        id, release_id, slug, title, position
      ) values (
        '30000000-0000-4000-8000-000000000901',
        '20000000-0000-4000-8000-000000000901',
        'migration-track',
        'Migration Track',
        1
      );
      insert into audio_assets (
        id, track_id, object_key, scope, mime_type, checksum_sha256,
        byte_size, duration_ms, codec, is_primary
      ) values (
        '40000000-0000-4000-8000-000000000901',
        '30000000-0000-4000-8000-000000000901',
        'video/migration-track.mp4',
        'publishable_derivative',
        'video/mp4',
        repeat('9', 64),
        1024,
        1000,
        'h264',
        true
      );
    `);

    for (const statement of migrations[4]!.sql) {
      await client.exec(statement);
    }

    const migrated = await client.query<{
      id: string;
      object_key: string;
      mime_type: string;
      codec: string;
      is_primary: boolean;
    }>(
      `select id, object_key, mime_type, codec, is_primary
       from video_assets
       where id = '40000000-0000-4000-8000-000000000901'`,
    );
    assert(
      migrated.rows.length === 1 &&
        migrated.rows[0]?.object_key === "video/migration-track.mp4" &&
        migrated.rows[0]?.mime_type === "video/mp4" &&
        migrated.rows[0]?.codec === "h264" &&
        migrated.rows[0]?.is_primary,
      "forward migration did not preserve the existing video asset",
    );
    const staleAudio = await client.query<{ count: number }>(
      `select count(*)::integer as count
       from audio_assets
       where id = '40000000-0000-4000-8000-000000000901'`,
    );
    assert(
      staleAudio.rows[0]?.count === 0,
      "forward migration left the video asset in audio_assets",
    );
    await expectRejection("video MIME in audio_assets", () =>
      client.query(
        `insert into audio_assets (
           track_id, object_key, scope, mime_type, checksum_sha256,
           byte_size, duration_ms, codec
         ) values (
           '30000000-0000-4000-8000-000000000901',
           'video/invalid-audio-row.mp4',
           'private_original',
           'video/mp4',
           repeat('8', 64),
           1024,
           1000,
           'h264'
         )`,
      ),
    );
    await expectRejection("audio MIME in video_assets", () =>
      client.query(
        `insert into video_assets (
           track_id, object_key, scope, mime_type, checksum_sha256,
           byte_size, duration_ms, codec
         ) values (
           '30000000-0000-4000-8000-000000000901',
           'audio/invalid-video-row.mp3',
           'private_original',
           'audio/mpeg',
           repeat('7', 64),
           1024,
           1000,
           'mp3'
         )`,
      ),
    );
  } finally {
    await client.close();
  }
}

async function validateHomepageCollectionsForwardMigration() {
  const client = new PGlite();
  try {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    assert(migrations.length === 7, "expected the original and six forward migrations");
    for (const migration of migrations.slice(0, 5)) {
      for (const statement of migration.sql) {
        await client.exec(statement);
      }
    }

    await client.exec(`
      insert into artwork_assets (
        id, object_key, scope, mime_type, checksum_sha256, byte_size, width, height
      ) values
        ('40000000-0000-4000-8000-000000000101', 'assets/thumbs/thumb-01.svg', 'publishable_derivative', 'image/svg+xml', repeat('1', 64), 1228, 1600, 900),
        ('40000000-0000-4000-8000-000000000102', 'assets/thumbs/thumb-02.svg', 'publishable_derivative', 'image/svg+xml', repeat('2', 64), 1227, 1600, 900),
        ('40000000-0000-4000-8000-000000000103', 'assets/thumbs/thumb-03.svg', 'publishable_derivative', 'image/svg+xml', repeat('3', 64), 1228, 1600, 900),
        ('40000000-0000-4000-8000-000000000104', 'assets/thumbs/thumb-05.svg', 'publishable_derivative', 'image/svg+xml', repeat('4', 64), 1231, 1600, 900),
        ('40000000-0000-4000-8000-000000000105', 'assets/thumbs/thumb-09.svg', 'publishable_derivative', 'image/svg+xml', repeat('5', 64), 1229, 1600, 900);

      insert into artists (
        id, slug, display_name, biography, lifecycle_status, published_at
      ) values (
        '10000000-0000-4000-8000-000000000101', 'sunstruck-synapse', 'Sunstruck Synapse',
        'Human-directed transmissions.', 'published', '2026-01-15T12:00:00.000Z'
      );

      insert into artist_artwork_assets (
        artist_id, artwork_asset_id, role, position, alt_text
      ) values (
        '10000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000101', 'avatar', 1, 'Avatar'
      );

      insert into releases (
        id, slug, title, release_date, lifecycle_status, published_at
      ) values (
        '20000000-0000-4000-8000-000000000101', 'phase-zero-transmissions', 'Phase Zero Transmissions',
        '2026-01-15T12:00:00.000Z', 'published', '2026-01-15T12:00:00.000Z'
      );

      insert into release_artist_credits (
        release_id, artist_id, position, credited_as
      ) values (
        '20000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000101', 1, 'Sunstruck Synapse'
      );

      insert into release_artwork_assets (
        release_id, artwork_asset_id, role, position, alt_text
      ) values (
        '20000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000101', 'primary', 1, 'Cover'
      );

      insert into tracks (
        id, release_id, slug, title, disc_number, position, lifecycle_status, published_at
      ) values
        ('30000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000101', 'ai-pop-slop-202607190035', 'AI Pop-Slop 202607190035', 1, 1, 'published', '2026-01-15T12:00:00.000Z'),
        ('30000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000101', 'revolution-will-be-televised', 'Sunstruck Synapse (Revolution will be televised)', 1, 2, 'published', '2026-01-15T12:00:00.000Z'),
        ('30000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000101', 'final-movie-00007', 'Final Movie 00007', 1, 3, 'published', '2026-01-15T12:00:00.000Z'),
        ('30000000-0000-4000-8000-000000000104', '20000000-0000-4000-8000-000000000101', 'the-mushroom-circle-gnome-revolution', 'The Mushroom Circle (Gnome Revolution)', 1, 4, 'published', '2026-01-15T12:00:00.000Z'),
        ('30000000-0000-4000-8000-000000000105', '20000000-0000-4000-8000-000000000101', 'gone-fishing', 'Gone Fishing', 1, 5, 'published', '2026-01-15T12:00:00.000Z');

      insert into track_artist_credits (track_id, artist_id, position, credited_as) values
        ('30000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000101', 1, 'Sunstruck Synapse'),
        ('30000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000101', 1, 'Sunstruck Synapse'),
        ('30000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000101', 1, 'Sunstruck Synapse'),
        ('30000000-0000-4000-8000-000000000104', '10000000-0000-4000-8000-000000000101', 1, 'Sunstruck Synapse'),
        ('30000000-0000-4000-8000-000000000105', '10000000-0000-4000-8000-000000000101', 1, 'Sunstruck Synapse');

      insert into track_artwork_assets (track_id, artwork_asset_id, role, position, alt_text) values
        ('30000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000101', 'primary', 1, 'Artwork 1'),
        ('30000000-0000-4000-8000-000000000102', '40000000-0000-4000-8000-000000000102', 'primary', 1, 'Artwork 2'),
        ('30000000-0000-4000-8000-000000000103', '40000000-0000-4000-8000-000000000103', 'primary', 1, 'Artwork 3'),
        ('30000000-0000-4000-8000-000000000104', '40000000-0000-4000-8000-000000000104', 'primary', 1, 'Artwork 4'),
        ('30000000-0000-4000-8000-000000000105', '40000000-0000-4000-8000-000000000105', 'primary', 1, 'Artwork 5');

      insert into audio_assets (
        id, track_id, object_key, scope, mime_type, checksum_sha256, byte_size, duration_ms, codec, is_primary
      ) values
        ('50000000-0000-4000-8000-000000000102', '30000000-0000-4000-8000-000000000102', 'assets/audio/revolution.mp3', 'publishable_derivative', 'audio/mpeg', repeat('a', 64), 7138735, 445289, 'mp3', true),
        ('50000000-0000-4000-8000-000000000104', '30000000-0000-4000-8000-000000000104', 'assets/audio/mushroom.mp3', 'publishable_derivative', 'audio/mpeg', repeat('b', 64), 8766686, 547039, 'mp3', true);

      insert into video_assets (
        id, track_id, object_key, scope, mime_type, checksum_sha256, byte_size, duration_ms, codec, is_primary
      ) values
        ('50000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000101', 'assets/video/slop.mp4', 'publishable_derivative', 'video/mp4', repeat('c', 64), 9613030, 30016, 'h264-aac', true),
        ('50000000-0000-4000-8000-000000000103', '30000000-0000-4000-8000-000000000103', 'assets/video/movie.mp4', 'publishable_derivative', 'video/mp4', repeat('d', 64), 2249897, 14458, 'h264-aac', true),
        ('50000000-0000-4000-8000-000000000105', '30000000-0000-4000-8000-000000000105', 'assets/video/fishing.mp4', 'publishable_derivative', 'video/mp4', repeat('e', 64), 13983942, 15000, 'h264-aac', true);

      insert into editorial_collections (
        id, slug, name, description, artwork_asset_id, lifecycle_status, published_at
      ) values (
        '60000000-0000-4000-8000-000000000101', 'latest-transmissions', 'Latest transmissions',
        'The newest published transmissions selected for the radio.',
        '40000000-0000-4000-8000-000000000101', 'published', '2026-01-15T12:00:00.000Z'
      );

      insert into collection_items (id, collection_id, track_id, position) values
        ('61000000-0000-4000-8000-000000000101', '60000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000101', 1),
        ('61000000-0000-4000-8000-000000000102', '60000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000102', 2),
        ('61000000-0000-4000-8000-000000000103', '60000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000103', 3),
        ('61000000-0000-4000-8000-000000000104', '60000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000104', 4);
    `);

    for (const statement of migrations[5]!.sql) {
      await client.exec(statement);
    }

    const db = drizzle(client, { schema });
    const repository = createCatalogueRepository(db);
    const catalogue = await loadPublicCatalogue(repository);

    assert(catalogue.status === "ready", "public catalogue is not ready after migration 0005");
    assert(
      catalogue.collections.length === 3,
      `expected 3 homepage collections, found ${catalogue.collections.length}`,
    );

    const slugs = catalogue.collections.map((c) => c.slug);
    assert(
      JSON.stringify(slugs) === JSON.stringify(["latest-transmissions", "listen", "watch"]),
      `expected homepage collection slugs ["latest-transmissions", "listen", "watch"], found ${JSON.stringify(slugs)}`,
    );

    const names = catalogue.collections.map((c) => c.name);
    assert(
      JSON.stringify(names) === JSON.stringify(["Latest transmissions", "Listen", "Watch"]),
      `expected homepage collection names ["Latest transmissions", "Listen", "Watch"], found ${JSON.stringify(names)}`,
    );

    const latestCollection = catalogue.collections[0]!;
    assert(
      latestCollection.items.length === 4,
      `expected 4 tracks in latest-transmissions, found ${latestCollection.items.length}`,
    );

    const listenCollection = catalogue.collections[1]!;
    assert(
      listenCollection.items.length === 2 &&
        listenCollection.items[0]?.slug === "revolution-will-be-televised" &&
        listenCollection.items[1]?.slug === "the-mushroom-circle-gnome-revolution",
      "listen collection does not contain the expected audio tracks in order",
    );

    const watchCollection = catalogue.collections[2]!;
    assert(
      watchCollection.items.length === 3 &&
        watchCollection.items[0]?.slug === "ai-pop-slop-202607190035" &&
        watchCollection.items[1]?.slug === "final-movie-00007" &&
        watchCollection.items[2]?.slug === "gone-fishing",
      "watch collection does not contain the expected video tracks in order",
    );

    const sections = buildCatalogueSections(catalogue.items, catalogue.collections);
    assert(
      JSON.stringify(sections.map((s) => s.id)) === JSON.stringify(["latest", "audio", "video"]),
      "homepage sections do not map to latest, audio, video section IDs",
    );
    assert(
      JSON.stringify(sections.map((s) => s.icon)) === JSON.stringify(["✦", "✺", "✹"]),
      "homepage section icons do not match expected symbols",
    );
    assert(
      sections[0]?.items.length === 4 &&
        sections[1]?.items.length === 2 &&
        sections[2]?.items.length === 3,
      "homepage section item counts do not match expected counts",
    );
  } finally {
    await client.close();
  }
}

try {
  await validateExistingHistoryGuard();
  await validateVideoAssetForwardMigration();
  await validateHomepageCollectionsForwardMigration();
  const expectedCounts = await validateFirstDatabase();
  await validateFreshReset(expectedCounts);
  console.log(
    "Local PGlite validation passed: forward data migration, schema objects, shared seed idempotence, all three governance lifecycles, relations, ordering, constraints, timestamps, and fresh reset.",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown validation failure";
  console.error(message);
  process.exitCode = 1;
}
