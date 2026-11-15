import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../app/db/schema";
import { createArtworkPalettesRepository } from "../../app/repositories/artwork-palettes.server";
import { backfillArtworkPalettes } from "../../app/services/artwork-palette-backfill.server";
import { createStaticArtworkPaletteProcessor } from "../../app/services/artwork-palette-static-backfill.server";
import { createCurationOutboxRepository } from "../../app/repositories/curation-outbox.server";

const colors = {
  accent: "#8b2438",
  paperLight: "#fafafa",
  surfaceLight: "#ffffff",
  inkLight: "#111111",
  paperDark: "#111111",
  surfaceDark: "#222222",
  inkDark: "#ffffff",
};
const checksum = "a".repeat(64);
describe("durable artwork palette storage", () => {
  let client: PGlite;
  let repository: ReturnType<typeof createArtworkPalettesRepository>;
  let outbox: ReturnType<typeof createCurationOutboxRepository>;
  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    repository = createArtworkPalettesRepository(db);
    outbox = createCurationOutboxRepository(db);
  }, 30_000);
  afterAll(async () => {
    await client.close();
  });
  beforeEach(async () => {
    await client.exec(
      "truncate artwork_assets,artists,curation_outbox cascade; update artwork_palette_settings set enable_new_artwork=false",
    );
  });
  async function asset(options: { scope?: string; status?: string; key?: string } = {}) {
    const result = await client.query<{ id: string }>(
      `insert into artwork_assets(object_key,storage_provider,scope,status,mime_type,checksum_sha256,byte_size,width,height)
      values($1,'r2',$2,$3,'image/png',$4,100,1400,1400) returning id`,
      [
        options.key ?? crypto.randomUUID(),
        options.scope ?? "publishable_derivative",
        options.status ?? "ready",
        checksum,
      ],
    );
    return result.rows[0].id;
  }
  async function jobFor(id: string) {
    const source = await repository.getSource(id);
    if (!source) throw new Error("Missing test source");
    await repository.enqueue(id);
    const job = (await outbox.claim({ limit: 1 }))[0];
    return { source, job, jobId: job.id, leaseToken: job.leaseToken };
  }
  it("migration leaves existing metadata alone and producer disabled until rollout", async () => {
    const foreignKeys = await client.query<{ conname: string }>(
      "select conname from pg_constraint where contype='f' and conrelid in ('artwork_palette_generations'::regclass,'artwork_palette_overrides'::regclass) order by conname",
    );
    expect(foreignKeys.rows.map((row) => row.conname)).toEqual([
      "artwork_palette_generations_artwork_asset_id_artwork_assets_id_fk".slice(0, 63),
      "artwork_palette_overrides_artwork_asset_id_artwork_assets_id_fk".slice(0, 63),
    ]);
    const id = await asset();
    expect((await client.query("select * from curation_outbox")).rows).toHaveLength(0);
    await client.exec("update artwork_palette_settings set enable_new_artwork=true");
    expect((await client.query("select * from curation_outbox")).rows).toHaveLength(0);
    await client.query("update artwork_assets set byte_size=101 where id=$1", [id]);
    expect((await client.query("select * from curation_outbox")).rows).toHaveLength(1);
  });
  it("captures direct inserts and eligibility transitions without upload-hook dependency", async () => {
    await client.exec("update artwork_palette_settings set enable_new_artwork=true");
    await asset();
    const privateId = await asset({ scope: "private_master" });
    const pendingId = await asset({ status: "deleted" });
    expect((await client.query("select * from curation_outbox")).rows).toHaveLength(1);
    await client.query("update artwork_assets set scope='publishable_derivative' where id=$1", [
      privateId,
    ]);
    await client.query("update artwork_assets set status='ready' where id=$1", [pendingId]);
    expect((await client.query("select * from curation_outbox")).rows).toHaveLength(3);
  });
  it("queues a shared asset once and returns stable distinct UUID cursor pages", async () => {
    const id = await asset();
    for (const slug of ["first", "second"]) {
      await client.query(
        `with ar as (insert into artists(slug,display_name) values($1,$1) returning id)
        insert into artist_artwork_assets(artist_id,artwork_asset_id,role) select id,$2,'primary' from ar`,
        [slug, id],
      );
    }
    const other = await asset();
    const queuedId = await repository.enqueue(id);
    expect(await repository.enqueue(id)).toBe(queuedId);
    const first = await repository.selectBackfill({ limit: 1 });
    const second = await repository.selectBackfill({ limit: 1, after: first[0].assetId });
    expect(new Set([first[0].assetId, second[0].assetId])).toEqual(new Set([id, other]));
    const shared = [...first, ...second].find((row) => row.assetId === id);
    expect(shared?.reviewedSlugs).toEqual(["first", "second"]);
  });
  it("resumes an interrupted static enqueue in a later approved write batch", async () => {
    const id = await asset();
    await client.query(
      "update artwork_assets set storage_provider='static',object_key='assets/resume.png' where id=$1",
      [id],
    );
    const originalJobId = await repository.enqueue(id);
    const processStatic = createStaticArtworkPaletteProcessor({
      palettes: repository,
      outbox,
      decode: async () => colors,
      async claimExact(jobId) {
        const [job] = await outbox.claim({ kinds: ["artwork_palette_generate"], limit: 1 });
        expect(job.id).toBe(jobId);
        expect(jobId).toBe(originalJobId);
        return job.leaseToken;
      },
    });
    const report = await backfillArtworkPalettes(
      repository,
      { environment: "development", limit: 10, write: true },
      new Set(),
      processStatic,
    );
    expect(report).toMatchObject({ scanned: 1, processed: 1, queued: 0, failed: 0 });
    expect((await repository.publicPalettes([id])).get(id)?.colors).toEqual(colors);
    expect((await client.query("select * from curation_outbox")).rows).toHaveLength(1);
  });
  it("rejects stale source and stale lease independently and hides replaced colors", async () => {
    const id = await asset();
    const input = await jobFor(id);
    expect(await repository.persistReady({ ...input, colors })).toBe(true);
    expect((await repository.publicPalettes([id])).get(id)?.source).toBe("generated");
    expect((await repository.selectBackfill({ limit: 10 }))[0].current).toBe(true);
    expect(await repository.enqueue(id)).toBeNull();
    await client.query("update artwork_assets set checksum_sha256=$2 where id=$1", [
      id,
      "b".repeat(64),
    ]);
    expect(await repository.persistReady({ ...input, colors })).toBe(false);
    expect((await repository.publicPalettes([id])).size).toBe(0);
    await client.query("update artwork_assets set checksum_sha256=$2 where id=$1", [id, checksum]);
    await client.query(
      "update curation_outbox set lease_expires_at=now()-interval '1 second' where id=$1",
      [input.jobId],
    );
    expect(await repository.persistFailed({ ...input, errorCode: "DECODE_FAILED" })).toBe(false);
  });
  it("fences public colors against the full chosen artwork source snapshot", async () => {
    const id = await asset();
    const input = await jobFor(id);
    await repository.persistReady({ ...input, colors });
    const expected = new Map([[id, { ...input.source, objectKey: "old/key.png" }]]);
    expect((await repository.publicPalettes([id], expected)).size).toBe(0);
    expect((await repository.publicPalettes([id], new Map([[id, input.source]]))).size).toBe(1);
  });
  it("keeps a late human override separate and preferred through generator completion", async () => {
    const id = await asset();
    const input = await jobFor(id);
    const override = { ...colors, accent: "#17456a" };
    await client.query(
      "insert into artwork_palette_overrides(artwork_asset_id,colors) values($1,$2::jsonb)",
      [id, JSON.stringify(override)],
    );
    expect(await repository.persistReady({ ...input, colors })).toBe(true);
    expect((await repository.publicPalettes([id])).get(id)).toEqual({
      version: 1,
      source: "override",
      colors: override,
    });
    expect(await repository.enqueue(id, { requeueFailed: true })).toBeNull();
    expect((await repository.selectBackfill({ limit: 10 }))[0].hasOverride).toBe(true);
  });
  it("rejects arbitrary CSS and low contrast before persistence and malformed database JSON", async () => {
    const id = await asset();
    const input = await jobFor(id);
    await expect(
      repository.persistReady({
        ...input,
        colors: { ...colors, accent: "url(https://example.test)" },
      }),
    ).rejects.toThrow();
    await expect(
      repository.persistReady({ ...input, colors: { ...colors, inkLight: "#fafafa" } }),
    ).rejects.toThrow();
    await expect(
      client.query(
        "insert into artwork_palette_overrides(artwork_asset_id,colors) values($1,$2::jsonb)",
        [id, JSON.stringify({ accent: "red" })],
      ),
    ).rejects.toThrow();
    await expect(
      client.query(
        "insert into artwork_palette_overrides(artwork_asset_id,colors) values($1,$2::jsonb)",
        [id, JSON.stringify({ ...colors, inkLight: "#fafafa" })],
      ),
    ).rejects.toThrow();
    expect((await repository.publicPalettes([id])).size).toBe(0);
  });
  it("explicitly requeues failed identities while ordinary enqueue preserves failure evidence", async () => {
    const id = await asset();
    const input = await jobFor(id);
    expect(await repository.persistFailed({ ...input, errorCode: "DECODE_FAILED" })).toBe(true);
    await client.query(
      "update curation_outbox set status='failed',completed_at=now(),lease_token=null,lease_expires_at=null where id=$1",
      [input.jobId],
    );
    expect(await repository.enqueue(id)).toBeNull();
    const replacementJob = await repository.enqueue(id, { requeueFailed: true });
    expect(replacementJob).toBeTypeOf("string");
    expect(replacementJob).not.toBe(input.jobId);
    expect(
      (
        await client.query<{ status: string }>("select status from curation_outbox where id=$1", [
          input.jobId,
        ])
      ).rows[0].status,
    ).toBe("failed");
    const result = await client.query<{ status: string; colors: unknown }>(
      "select status,colors from artwork_palette_generations where artwork_asset_id=$1",
      [id],
    );
    expect(result.rows[0]).toEqual({ status: "pending", colors: null });
  });
  it("requeues a previously successful identity when source replacement later reverts", async () => {
    await client.exec("update artwork_palette_settings set enable_new_artwork=true");
    const id = await asset();
    const input = await jobFor(id);
    await repository.persistReady({ ...input, colors });
    await outbox.acknowledge(input.jobId, input.leaseToken);
    await client.query("update artwork_assets set byte_size=101 where id=$1", [id]);
    await client.query("update artwork_assets set byte_size=100 where id=$1", [id]);
    const result = await client.query<{ status: string }>(
      "select status from curation_outbox where id=$1",
      [input.jobId],
    );
    expect(result.rows[0].status).toBe("succeeded");
    const jobs = await client.query<{ status: string; payload: { generationRevision: number } }>(
      "select status,payload from curation_outbox where payload->>'assetId'=$1 order by (payload->>'generationRevision')::integer",
      [id],
    );
    expect(jobs.rows.map((row) => row.payload.generationRevision)).toEqual([1, 2, 3]);
    expect(jobs.rows.map((row) => row.status)).toEqual(["succeeded", "pending", "pending"]);
    expect(await repository.persistReady({ ...input, colors })).toBe(false);
  });
  it("preserves active jobs on explicit duplicate requeues and fences old active source occurrences", async () => {
    await client.exec("update artwork_palette_settings set enable_new_artwork=true");
    const id = await asset();
    const input = await jobFor(id);
    await repository.persistFailed({ ...input, errorCode: "DECODE_FAILED" });
    expect(await repository.enqueue(id, { requeueFailed: true })).toBe(input.jobId);
    const active = await client.query<{
      status: string;
      lease_token: string;
      payload: { generationRevision: number };
    }>("select status,lease_token,payload from curation_outbox where id=$1", [input.jobId]);
    expect(active.rows[0].status).toBe("processing");
    expect(active.rows[0].lease_token).toBe(input.leaseToken);
    expect(active.rows[0].payload.generationRevision).toBe(1);
    await client.query("update artwork_assets set byte_size=101 where id=$1", [id]);
    await client.query("update artwork_assets set byte_size=100 where id=$1", [id]);
    expect(await repository.persistReady({ ...input, colors })).toBe(false);
  });
});
