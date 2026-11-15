import { sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../db/schema";
import {
  ALGORITHM_VERSION,
  parseArtworkPalette,
  type PublicArtworkPalette,
} from "../services/artwork-palette";

export interface ArtworkPaletteSource {
  assetId: string;
  objectKey: string;
  storageProvider: "static" | "r2";
  checksumSha256: string;
  mimeType: string;
  byteSize: number;
  algorithmVersion: typeof ALGORITHM_VERSION;
}
export interface ArtworkPaletteBackfillRow extends ArtworkPaletteSource {
  current: boolean;
  hasOverride: boolean;
  reviewedSlugs: string[];
}
export interface ArtworkPalettePersistenceInput {
  jobId: string;
  leaseToken: string;
  source: ArtworkPaletteSource;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertUuid(value: string) {
  if (!UUID.test(value)) throw new TypeError("Invalid artwork palette identifier.");
}
function sourcePredicate(source: ArtworkPaletteSource): SQL {
  assertUuid(source.assetId);
  if (source.algorithmVersion !== ALGORITHM_VERSION)
    throw new TypeError("Unsupported palette algorithm.");
  return sql`a.id=${source.assetId}::uuid and a.object_key=${source.objectKey}
    and a.storage_provider::text=${source.storageProvider} and a.checksum_sha256=${source.checksumSha256}
    and a.mime_type=${source.mimeType} and a.byte_size=${source.byteSize}
    and a.status='ready' and a.scope='publishable_derivative'
    and g.source_object_key=a.object_key and g.source_storage_provider=a.storage_provider::text
    and g.source_checksum_sha256=a.checksum_sha256 and g.source_mime_type=a.mime_type
    and g.source_byte_size=a.byte_size and g.algorithm_version=${ALGORITHM_VERSION}`;
}
function leasePredicate(input: ArtworkPalettePersistenceInput): SQL {
  assertUuid(input.jobId);
  assertUuid(input.leaseToken);
  const source = input.source;
  return sql`exists (select 1 from curation_outbox j where j.id=${input.jobId}::uuid
    and j.kind='artwork_palette_generate' and j.status='processing'
    and j.lease_token=${input.leaseToken}::uuid and j.lease_expires_at>now()
    and j.payload @> ${JSON.stringify(source)}::jsonb
    and j.payload->>'generationRevision'=g.generation_revision::text)`;
}
const sourceColumns = sql`a.id as "assetId",a.object_key as "objectKey",a.storage_provider as "storageProvider",
  a.checksum_sha256 as "checksumSha256",a.mime_type as "mimeType",a.byte_size::float8 as "byteSize",1 as "algorithmVersion"`;

export function createArtworkPalettesRepository<TQueryResult extends PgQueryResultHKT>(
  db: PgDatabase<TQueryResult, typeof schema>,
) {
  async function rows<T>(query: SQL): Promise<T[]> {
    const result: unknown = await db.execute<Record<string, unknown>>(query);
    if (Array.isArray(result)) return result as T[];
    if (result && typeof result === "object" && Array.isArray(Reflect.get(result, "rows")))
      return Reflect.get(result, "rows") as T[];
    throw new Error("Unsupported database query result.");
  }
  return {
    async getSource(assetId: string): Promise<ArtworkPaletteSource | null> {
      assertUuid(assetId);
      const found = await rows<
        ArtworkPaletteSource & Record<string, unknown>
      >(sql`select ${sourceColumns}
        from artwork_assets a where a.id=${assetId}::uuid and a.status='ready' and a.scope='publishable_derivative'`);
      return found[0] ?? null;
    },
    async selectBackfill(options: {
      limit: number;
      after?: string;
    }): Promise<ArtworkPaletteBackfillRow[]> {
      if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000)
        throw new TypeError("Palette backfill limit must be between 1 and 1000.");
      if (options.after) assertUuid(options.after);
      const candidates = await rows<
        ArtworkPaletteBackfillRow & { generatedColors: unknown } & Record<string, unknown>
      >(sql`select ${sourceColumns},g.colors as "generatedColors",
        (o.artwork_asset_id is not null) as "hasOverride",
        coalesce(g.status='ready' and g.algorithm_version=${ALGORITHM_VERSION} and g.source_object_key=a.object_key
          and g.source_storage_provider=a.storage_provider::text and g.source_checksum_sha256=a.checksum_sha256
          and g.source_mime_type=a.mime_type and g.source_byte_size=a.byte_size, false) as "current",
        array(select distinct linked.slug from (
          select ar.slug from artist_artwork_assets aa join artists ar on ar.id=aa.artist_id where aa.artwork_asset_id=a.id
          union select r.slug from release_artwork_assets ra join releases r on r.id=ra.release_id where ra.artwork_asset_id=a.id
          union select t.slug from track_artwork_assets ta join tracks t on t.id=ta.track_id where ta.artwork_asset_id=a.id
        ) linked order by linked.slug) as "reviewedSlugs"
        from artwork_assets a left join artwork_palette_generations g on g.artwork_asset_id=a.id
        left join artwork_palette_overrides o on o.artwork_asset_id=a.id
        where a.status='ready' and a.scope='publishable_derivative'
          ${options.after ? sql`and a.id>${options.after}::uuid` : sql``}
        order by a.id limit ${options.limit}`);
      return candidates.map(({ generatedColors, ...candidate }) => ({
        ...candidate,
        current: candidate.current && parseArtworkPalette(generatedColors) !== null,
      }));
    },
    async enqueue(
      assetId: string,
      options: { requeueFailed?: boolean } = {},
    ): Promise<string | null> {
      assertUuid(assetId);
      const found = await rows<{ id: string | null }>(
        sql`select enqueue_artwork_palette(${assetId}::uuid,${options.requeueFailed ?? false}) as id`,
      );
      return found[0]?.id ?? null;
    },
    async publicPalettes(
      assetIds: readonly string[],
      expectedSources?: ReadonlyMap<string, ArtworkPaletteSource>,
    ): Promise<Map<string, PublicArtworkPalette>> {
      const result = new Map<string, PublicArtworkPalette>();
      if (assetIds.length === 0) return result;
      for (const id of assetIds) assertUuid(id);
      // A build trigger may deploy the reader before the additive migration. Only
      // the two new missing relations permit palette fallback; other failures surface.
      function isUnmigratedPaletteRead(error: unknown): boolean {
        const seen = new Set<object>();
        let current = error;
        while (typeof current === "object" && current !== null && !seen.has(current)) {
          seen.add(current);
          if (Reflect.get(current, "code") === "42P01") {
            const table = Reflect.get(current, "table");
            const message = Reflect.get(current, "message");
            if (table === "artwork_palette_generations" || table === "artwork_palette_overrides")
              return true;
            if (
              typeof message === "string" &&
              /^relation "(?:public\.)?(?:artwork_palette_generations|artwork_palette_overrides)" does not exist$/.test(
                message,
              )
            )
              return true;
          }
          current = Reflect.get(current, "cause");
        }
        return false;
      }
      const found = await rows<
        ArtworkPaletteSource & {
          overrideVersion: number | null;
          overrideColors: unknown;
          generatedColors: unknown;
        }
      >(sql`
        select ${sourceColumns},o.version as "overrideVersion",o.colors as "overrideColors",g.colors as "generatedColors"
        from artwork_assets a left join artwork_palette_overrides o on o.artwork_asset_id=a.id
        left join artwork_palette_generations g on g.artwork_asset_id=a.id and g.status='ready'
          and g.algorithm_version=${ALGORITHM_VERSION} and g.source_object_key=a.object_key
          and g.source_storage_provider=a.storage_provider::text and g.source_checksum_sha256=a.checksum_sha256
          and g.source_mime_type=a.mime_type and g.source_byte_size=a.byte_size
        where a.id in (${sql.join(
          [...new Set(assetIds)].map((id) => sql`${id}::uuid`),
          sql`, `,
        )})
          and a.status='ready' and a.scope='publishable_derivative'`).catch((error: unknown) => {
        if (isUnmigratedPaletteRead(error)) return [];
        throw error;
      });
      for (const row of found) {
        const expected = expectedSources?.get(row.assetId);
        if (
          expectedSources &&
          (!expected ||
            expected.objectKey !== row.objectKey ||
            expected.storageProvider !== row.storageProvider ||
            expected.checksumSha256 !== row.checksumSha256 ||
            expected.mimeType !== row.mimeType ||
            expected.byteSize !== row.byteSize ||
            expected.algorithmVersion !== ALGORITHM_VERSION)
        )
          continue;
        const override = row.overrideVersion === 1 ? parseArtworkPalette(row.overrideColors) : null;
        const generated = parseArtworkPalette(row.generatedColors);
        const colors = override ?? generated;
        if (colors)
          result.set(row.assetId, {
            version: 1,
            source: override ? "override" : "generated",
            colors,
          });
      }
      return result;
    },
    async persistReady(
      input: ArtworkPalettePersistenceInput & { colors: unknown },
    ): Promise<boolean> {
      const colors = parseArtworkPalette(input.colors);
      if (!colors) throw new TypeError("Invalid artwork palette colors.");
      const found = await rows<{
        id: string;
      }>(sql`update artwork_palette_generations g set status='ready',colors=${JSON.stringify(colors)}::jsonb,error_code=null,updated_at=now()
        from artwork_assets a where g.artwork_asset_id=a.id and ${sourcePredicate(input.source)} and ${leasePredicate(input)} returning g.artwork_asset_id as id`);
      return found.length > 0;
    },
    async persistFailed(
      input: ArtworkPalettePersistenceInput & { errorCode: string },
    ): Promise<boolean> {
      if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(input.errorCode))
        throw new TypeError("Invalid palette error code.");
      const found = await rows<{
        id: string;
      }>(sql`update artwork_palette_generations g set status='failed',colors=null,error_code=${input.errorCode},updated_at=now()
        from artwork_assets a where g.artwork_asset_id=a.id and ${sourcePredicate(input.source)} and ${leasePredicate(input)} returning g.artwork_asset_id as id`);
      return found.length > 0;
    },
  };
}
