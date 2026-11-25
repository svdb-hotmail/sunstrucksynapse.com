import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addAbortSignal, Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";

import { AwsClient } from "aws4fetch";

import { SITE_URL } from "../app/config/brand";
import { validateDatabaseEnv } from "../app/config/env.server";
import { createDatabase } from "../app/db/client.server";
import { createCatalogueRepository } from "../app/repositories/catalogue.server";
import { SHARE_PREVIEW_TYPE, trackSharePreview } from "../app/services/track-share-preview";
import { encodeSharePreview } from "./encode-share-preview";

const [releaseSlug, trackSlug, option, ...extra] = process.argv.slice(2);
const replace = option === "--replace";
if (!releaseSlug || !trackSlug || (option && !replace) || extra.length) {
  throw new Error(
    "Usage: npm run share-preview:publish -- <release-slug> <track-slug> [--replace]",
  );
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function download(source: string, target: string, limit: number, mime: RegExp) {
  // Managed asset URLs redirect to the same origin with a fresh signature.
  const signal = AbortSignal.timeout(180_000);
  const response = await fetch(source, { signal });
  if (
    !response.ok ||
    !response.body ||
    new URL(response.url).origin !== SITE_URL ||
    !mime.test(response.headers.get("content-type") ?? "")
  ) {
    throw new Error("Could not download a supported public media source.");
  }
  let received = 0;
  const sizeLimit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > limit) callback(new Error("Public media source exceeds the size limit."));
      else callback(null, chunk);
    },
  });
  await pipeline(
    addAbortSignal(signal, Readable.fromWeb(response.body as ReadableStream<Uint8Array>)),
    sizeLimit,
    createWriteStream(target, { flags: "wx" }),
  );
}

const catalogue = createCatalogueRepository(createDatabase(validateDatabaseEnv(process.env)), {
  signingSecret: requiredEnv("MEDIA_DELIVERY_SIGNING_SECRET"),
});
const track = await catalogue.findPublishedTrack(releaseSlug, trackSlug);
const preview = track && (await trackSharePreview(track.item));
if (!preview) throw new Error("Published track, playable media, and raster artwork are required.");

const account = requiredEnv("R2_ACCOUNT_ID");
const bucket = requiredEnv("R2_BUCKET_NAME");
if (!/^[a-f0-9]{32}$/.test(account) || !/^[a-z0-9][a-z0-9-]+$/.test(bucket)) {
  throw new Error("Invalid R2 account or bucket name.");
}
const storage = new AwsClient({
  accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
  secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});
const objectUrl = `https://${account}.r2.cloudflarestorage.com/${bucket}/${preview.key}`;
const existing = await storage.fetch(objectUrl, { method: "HEAD" });
if (!replace && existing.ok && existing.headers.get("content-type") === SHARE_PREVIEW_TYPE) {
  console.log("A share preview already exists for these selected media.");
} else {
  if (existing.status !== 404 && !existing.ok) {
    throw new Error(`R2 preview lookup failed (HTTP ${existing.status}).`);
  }
  const directory = await mkdtemp(join(tmpdir(), "sunsyn-share-"));
  try {
    const artwork = join(directory, "artwork");
    const media = join(directory, "media");
    const output = join(directory, "share.mp4");
    await download(
      preview.artworkUrl,
      artwork,
      20 * 1024 ** 2,
      /^image\/(jpeg|png|webp|avif)(;|$)/i,
    );
    await download(preview.sourceUrl, media, 500 * 1024 ** 2, /^(audio|video)\//i);
    await encodeSharePreview(artwork, media, output);
    const current = await catalogue.findPublishedTrack(releaseSlug, trackSlug);
    if (!current || (await trackSharePreview(current.item))?.key !== preview.key) {
      throw new Error("Publication or selected media changed while encoding. Retry if eligible.");
    }
    const response = await storage.fetch(objectUrl, {
      method: "PUT",
      headers: { "content-type": SHARE_PREVIEW_TYPE },
      body: new Uint8Array(await readFile(output)),
    });
    if (!response.ok) throw new Error(`R2 preview upload failed (HTTP ${response.status}).`);
    console.log(`Share preview uploaded for ${releaseSlug}/${trackSlug}.`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
