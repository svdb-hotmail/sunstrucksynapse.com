import { writeFile } from "node:fs/promises";

import postgres from "postgres";

import { validateDatabaseEnv } from "../app/config/env.server";

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error("Usage: npm run catalogue:export -- <new-output-file.json>");
}

const { DATABASE_URL } = validateDatabaseEnv(process.env);
const sql = postgres(DATABASE_URL, { max: 1, prepare: false });

try {
  const [artists, releases, tracks, collections] = await Promise.all([
    sql`select id, slug, display_name, biography, lifecycle_status, published_at
        from artists order by slug`,
    sql`select id, slug, title, release_date, lifecycle_status, published_at
        from releases order by slug`,
    sql`select id, release_id, slug, title, disc_number, position, genre, moods,
               creative_process_tags, lifecycle_status, published_at
        from tracks order by release_id, disc_number, position`,
    sql`select c.id, c.slug, c.name, c.description, c.lifecycle_status, c.published_at,
               coalesce(
                 json_agg(
                   json_build_object(
                     'position', ci.position,
                     'trackId', ci.track_id,
                     'releaseId', ci.release_id,
                     'annotation', ci.annotation
                   ) order by ci.position
                 ) filter (where ci.id is not null),
                 '[]'::json
               ) as items
        from editorial_collections c
        left join collection_items ci on ci.collection_id = c.id
        group by c.id
        order by c.slug`,
  ]);
  const exportDocument = {
    format: "sunstruck-catalogue-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    note: "Public editorial metadata only. This is not a substitute for a full database backup.",
    artists,
    releases,
    tracks,
    collections,
  };
  await writeFile(outputPath, `${JSON.stringify(exportDocument, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(
    `Catalogue export written: ${artists.length} artists, ${releases.length} releases, ${tracks.length} tracks, ${collections.length} collections.`,
  );
} finally {
  await sql.end();
}
