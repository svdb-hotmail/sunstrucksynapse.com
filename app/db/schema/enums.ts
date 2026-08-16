import { pgEnum } from "drizzle-orm/pg-core";

export const catalogueLifecycle = pgEnum("catalogue_lifecycle", [
  "draft",
  "in_review",
  "scheduled",
  "published",
  "archived",
]);

export const assetScope = pgEnum("asset_scope", ["private_master", "publishable_derivative"]);

export const artworkRole = pgEnum("artwork_role", ["primary", "gallery", "avatar", "banner"]);

export const storageProvider = pgEnum("storage_provider", ["static", "r2"]);

export const managedAssetStatus = pgEnum("managed_asset_status", ["ready", "deleted"]);

export const uploadSessionStatus = pgEnum("upload_session_status", [
  "pending",
  "completed",
  "abandoned",
  "failed",
]);

export const uploadAssetKind = pgEnum("upload_asset_kind", ["artwork", "audio"]);

export const submissionStatus = pgEnum("submission_status", [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const authorityBasis = pgEnum("authority_basis", [
  "original_author",
  "licensed",
  "public_domain",
  "other",
]);

export const attestationStatus = pgEnum("attestation_status", ["draft", "attested", "superseded"]);

export const versionedRecordStatus = pgEnum("versioned_record_status", [
  "draft",
  "finalized",
  "superseded",
]);

export const provenanceSourceType = pgEnum("provenance_source_type", [
  "original_recording",
  "licensed_material",
  "public_domain",
  "generated_material",
  "other",
]);
