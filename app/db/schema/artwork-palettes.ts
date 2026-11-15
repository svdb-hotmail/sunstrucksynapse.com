import { sql } from "drizzle-orm";
import { bigint, boolean, check, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import type { ArtworkPalette } from "~/services/artwork-palette";
import { artworkAssets } from "./catalogue";
import { timestamps } from "./helpers";

export const artworkPaletteSettings = pgTable(
  "artwork_palette_settings",
  {
    singleton: boolean("singleton").primaryKey().default(true),
    enableNewArtwork: boolean("enable_new_artwork").notNull().default(false),
  },
  (table) => [check("artwork_palette_settings_singleton_check", sql`${table.singleton}`)],
);

export const artworkPaletteGenerations = pgTable(
  "artwork_palette_generations",
  {
    artworkAssetId: uuid("artwork_asset_id")
      .primaryKey()
      .references(() => artworkAssets.id, { onDelete: "cascade" }),
    sourceObjectKey: text("source_object_key").notNull(),
    sourceStorageProvider: text("source_storage_provider").notNull(),
    sourceChecksumSha256: text("source_checksum_sha256").notNull(),
    sourceMimeType: text("source_mime_type").notNull(),
    sourceByteSize: bigint("source_byte_size", { mode: "number" }).notNull(),
    algorithmVersion: integer("algorithm_version").notNull(),
    generationRevision: integer("generation_revision").notNull().default(1),
    status: text("status").$type<"pending" | "ready" | "failed">().notNull().default("pending"),
    colors: jsonb("colors").$type<ArtworkPalette>(),
    errorCode: text("error_code"),
    ...timestamps(),
  },
  (table) => [
    check(
      "artwork_palette_generations_generation_revision_check",
      sql`${table.generationRevision} > 0`,
    ),
    check(
      "artwork_palette_generation_source_check",
      sql`${table.sourceObjectKey} <> '' and ${table.sourceChecksumSha256} ~ '^[0-9a-f]{64}$' and ${table.sourceByteSize} > 0 and ${table.algorithmVersion} > 0 and ${table.sourceStorageProvider} in ('r2','static')`,
    ),
    check(
      "artwork_palette_generation_state_check",
      sql`(${table.status} = 'ready' and ${table.colors} is not null and artwork_palette_colors_valid(${table.colors}) and ${table.errorCode} is null) or (${table.status} = 'pending' and ${table.colors} is null and ${table.errorCode} is null) or (${table.status} = 'failed' and ${table.colors} is null and ${table.errorCode} is not null and ${table.errorCode} ~ '^[A-Z][A-Z0-9_]{0,63}$')`,
    ),
  ],
);

export const artworkPaletteOverrides = pgTable(
  "artwork_palette_overrides",
  {
    artworkAssetId: uuid("artwork_asset_id")
      .primaryKey()
      .references(() => artworkAssets.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    colors: jsonb("colors").$type<ArtworkPalette>().notNull(),
    ...timestamps(),
  },
  (table) => [
    check(
      "artwork_palette_override_colors_check",
      sql`${table.version} = 1 and artwork_palette_colors_valid(${table.colors})`,
    ),
  ],
);
