import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { releases, tracks } from "./catalogue";
import {
  attestationStatus,
  authorityBasis,
  provenanceSourceType,
  versionedRecordStatus,
} from "./enums";
import { timestamps } from "./helpers";
import { submissions } from "./submissions";

export const rightsDeclarations = pgTable(
  "rights_declarations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "restrict",
    }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "restrict" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    supersedesId: uuid("supersedes_id"),
    status: attestationStatus("status").default("draft").notNull(),
    authorityBasis: authorityBasis("authority_basis").notNull(),
    authorityDetails: text("authority_details"),
    containsThirdPartyMaterial: boolean("contains_third_party_material").default(false).notNull(),
    thirdPartyMaterialDetails: text("third_party_material_details"),
    restrictions: text("restrictions"),
    attestation: text("attestation"),
    attestedAt: timestamp("attested_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: "rights_declarations_supersedes_id_fk",
      columns: [table.supersedesId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    uniqueIndex("rights_declarations_submission_version_unique")
      .on(table.submissionId, table.version)
      .where(sql`${table.submissionId} is not null`),
    uniqueIndex("rights_declarations_release_version_unique")
      .on(table.releaseId, table.version)
      .where(sql`${table.releaseId} is not null`),
    uniqueIndex("rights_declarations_track_version_unique")
      .on(table.trackId, table.version)
      .where(sql`${table.trackId} is not null`),
    uniqueIndex("rights_declarations_supersedes_unique")
      .on(table.supersedesId)
      .where(sql`${table.supersedesId} is not null`),
    index("rights_declarations_submission_id_idx").on(table.submissionId),
    index("rights_declarations_release_id_idx").on(table.releaseId),
    index("rights_declarations_track_id_idx").on(table.trackId),
    index("rights_declarations_supersedes_id_idx").on(table.supersedesId),
    index("rights_declarations_status_idx").on(table.status),
    check(
      "rights_declarations_parent_check",
      sql`num_nonnulls(${table.submissionId}, ${table.releaseId}, ${table.trackId}) = 1`,
    ),
    check("rights_declarations_version_check", sql`${table.version} > 0`),
    check(
      "rights_declarations_self_supersession_check",
      sql`${table.supersedesId} is null or ${table.supersedesId} <> ${table.id}`,
    ),
    check(
      "rights_declarations_attestation_check",
      sql`(${table.status} = 'draft' and ${table.attestedAt} is null and ${table.attestation} is null) or (${table.status} in ('attested', 'superseded') and ${table.attestedAt} is not null and nullif(btrim(${table.attestation}), '') is not null)`,
    ),
    check(
      "rights_declarations_third_party_check",
      sql`not ${table.containsThirdPartyMaterial} or nullif(btrim(${table.thirdPartyMaterialDetails}), '') is not null`,
    ),
  ],
);

export const creativeProcessDisclosures = pgTable(
  "creative_process_disclosures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "restrict",
    }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "restrict" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    supersedesId: uuid("supersedes_id"),
    status: versionedRecordStatus("status").default("draft").notNull(),
    aiUsed: boolean("ai_used").notNull(),
    aiUseDescription: text("ai_use_description"),
    meaningfulHumanContribution: text("meaningful_human_contribution").notNull(),
    toolsAndSystems: text("tools_and_systems").array().notNull(),
    sourceMaterialContext: text("source_material_context"),
    artistSummary: text("artist_summary").notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: "creative_process_disclosures_supersedes_id_fk",
      columns: [table.supersedesId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    uniqueIndex("creative_process_disclosures_submission_version_unique")
      .on(table.submissionId, table.version)
      .where(sql`${table.submissionId} is not null`),
    uniqueIndex("creative_process_disclosures_release_version_unique")
      .on(table.releaseId, table.version)
      .where(sql`${table.releaseId} is not null`),
    uniqueIndex("creative_process_disclosures_track_version_unique")
      .on(table.trackId, table.version)
      .where(sql`${table.trackId} is not null`),
    uniqueIndex("creative_process_disclosures_supersedes_unique")
      .on(table.supersedesId)
      .where(sql`${table.supersedesId} is not null`),
    index("creative_process_disclosures_submission_id_idx").on(table.submissionId),
    index("creative_process_disclosures_release_id_idx").on(table.releaseId),
    index("creative_process_disclosures_track_id_idx").on(table.trackId),
    index("creative_process_disclosures_supersedes_id_idx").on(table.supersedesId),
    index("creative_process_disclosures_status_idx").on(table.status),
    check(
      "creative_process_disclosures_parent_check",
      sql`num_nonnulls(${table.submissionId}, ${table.releaseId}, ${table.trackId}) = 1`,
    ),
    check("creative_process_disclosures_version_check", sql`${table.version} > 0`),
    check(
      "creative_process_disclosures_self_supersession_check",
      sql`${table.supersedesId} is null or ${table.supersedesId} <> ${table.id}`,
    ),
    check(
      "creative_process_disclosures_finalized_check",
      sql`(${table.status} = 'draft' and ${table.finalizedAt} is null) or (${table.status} in ('finalized', 'superseded') and ${table.finalizedAt} is not null)`,
    ),
    check(
      "creative_process_disclosures_ai_use_check",
      sql`not ${table.aiUsed} or nullif(btrim(${table.aiUseDescription}), '') is not null`,
    ),
    check(
      "creative_process_disclosures_human_contribution_check",
      sql`nullif(btrim(${table.meaningfulHumanContribution}), '') is not null`,
    ),
    check(
      "creative_process_disclosures_artist_summary_check",
      sql`nullif(btrim(${table.artistSummary}), '') is not null`,
    ),
  ],
);

export const provenanceRecords = pgTable(
  "provenance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "restrict",
    }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "restrict" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    supersedesId: uuid("supersedes_id"),
    status: versionedRecordStatus("status").default("draft").notNull(),
    summary: text("summary").notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: "provenance_records_supersedes_id_fk",
      columns: [table.supersedesId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    uniqueIndex("provenance_records_submission_version_unique")
      .on(table.submissionId, table.version)
      .where(sql`${table.submissionId} is not null`),
    uniqueIndex("provenance_records_release_version_unique")
      .on(table.releaseId, table.version)
      .where(sql`${table.releaseId} is not null`),
    uniqueIndex("provenance_records_track_version_unique")
      .on(table.trackId, table.version)
      .where(sql`${table.trackId} is not null`),
    uniqueIndex("provenance_records_supersedes_unique")
      .on(table.supersedesId)
      .where(sql`${table.supersedesId} is not null`),
    index("provenance_records_submission_id_idx").on(table.submissionId),
    index("provenance_records_release_id_idx").on(table.releaseId),
    index("provenance_records_track_id_idx").on(table.trackId),
    index("provenance_records_supersedes_id_idx").on(table.supersedesId),
    index("provenance_records_status_idx").on(table.status),
    check(
      "provenance_records_parent_check",
      sql`num_nonnulls(${table.submissionId}, ${table.releaseId}, ${table.trackId}) = 1`,
    ),
    check("provenance_records_version_check", sql`${table.version} > 0`),
    check(
      "provenance_records_self_supersession_check",
      sql`${table.supersedesId} is null or ${table.supersedesId} <> ${table.id}`,
    ),
    check(
      "provenance_records_finalized_check",
      sql`(${table.status} = 'draft' and ${table.finalizedAt} is null) or (${table.status} in ('finalized', 'superseded') and ${table.finalizedAt} is not null)`,
    ),
    check(
      "provenance_records_summary_check",
      sql`nullif(btrim(${table.summary}), '') is not null`,
    ),
  ],
);

export const provenanceSteps = pgTable(
  "provenance_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provenanceRecordId: uuid("provenance_record_id")
      .notNull()
      .references(() => provenanceRecords.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    processType: text("process_type").notNull(),
    description: text("description").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("provenance_steps_position_unique").on(
      table.provenanceRecordId,
      table.position,
    ),
    index("provenance_steps_record_order_idx").on(table.provenanceRecordId, table.position),
    check("provenance_steps_position_check", sql`${table.position} > 0`),
  ],
);

export const provenanceSources = pgTable(
  "provenance_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provenanceRecordId: uuid("provenance_record_id")
      .notNull()
      .references(() => provenanceRecords.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    sourceType: provenanceSourceType("source_type").notNull(),
    reference: text("reference").notNull(),
    rightsContext: text("rights_context"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("provenance_sources_position_unique").on(
      table.provenanceRecordId,
      table.position,
    ),
    index("provenance_sources_record_order_idx").on(
      table.provenanceRecordId,
      table.position,
    ),
    check(
      "provenance_sources_reference_check",
      sql`nullif(btrim(${table.reference}), '') is not null`,
    ),
  ],
);

export const provenanceEvidence = pgTable(
  "provenance_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provenanceRecordId: uuid("provenance_record_id")
      .notNull()
      .references(() => provenanceRecords.id, { onDelete: "cascade" }),
    storageProvider: text("storage_provider").notNull(),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("provenance_evidence_storage_ref_unique").on(
      table.storageProvider,
      table.objectKey,
    ),
    index("provenance_evidence_provenance_record_id_idx").on(table.provenanceRecordId),
    check(
      "provenance_evidence_object_key_check",
      sql`${table.objectKey} !~* '^https?://' and nullif(btrim(${table.objectKey}), '') is not null`,
    ),
    check(
      "provenance_evidence_checksum_sha256_check",
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check("provenance_evidence_byte_size_check", sql`${table.byteSize} > 0`),
  ],
);
