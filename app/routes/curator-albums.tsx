import { GENRES, MOODS, PROCESS_TAGS, validSelections } from "~/config/music-metadata";
import { sql } from "drizzle-orm";
import {
  Link,
  useLoaderData,
  useRevalidator,
  useFetcher,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { PublishingWorkspace } from "~/features/curator-workspace/PublishingWorkspace";
import { CuratorBadge, CuratorPanel } from "~/features/curator-workspace/CuratorPrimitives";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { validateUuid } from "~/services/curator-validation";
import {
  createAlbumPublishingRepository,
  type AlbumPreparation,
} from "~/repositories/album-publishing.server";
import { useEffect, useState } from "react";
import { createReleasePreparationRepository } from "~/repositories/release-preparation.server";
import { CuratorShell } from "~/features/curator-workspace/CuratorShell";

async function runtimeFor(request: Request, context: LoaderFunctionArgs["context"]) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) throw auth.response;
  if (!runtime.db || !runtime.curatorRepository)
    throw new Response("Album service unavailable.", { status: 503 });
  return {
    db: runtime.db,
    curator: runtime.curatorRepository,
    identity: auth.identity,
    encodingAvailable: Boolean(runtime.env?.AUDIO_ENCODER),
  };
}
export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, curator, identity, encodingAvailable } = await runtimeFor(request, context);
  const repository = createAlbumPublishingRepository(db);
  const params = new URL(request.url).searchParams;
  const selected = params.get("album");
  const focusedTrack = params.get("track");
  if ((selected && !validId(selected)) || (focusedTrack && !validId(focusedTrack)))
    throw new Response("Invalid release or track.", { status: 400 });
  const focusedRelease = focusedTrack
    ? await repository.releaseForAcceptedTrack(focusedTrack)
    : null;
  if (focusedTrack && !focusedRelease)
    throw new Response("Accepted track not found.", { status: 404 });
  const albumId = selected ?? focusedRelease;
  // Bracket every visible field with the same revision. Never pair old details
  // with a newer confirmation token if another curator saves during the load.
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = albumId ? await repository.publicationRevision(albumId) : null;
    const [artists, releases, tracks, readiness, preview] = await Promise.all([
      curator.list("artist"),
      curator.list("release"),
      repository.inventory(),
      albumId ? repository.readiness(albumId) : Promise.resolve([]),
      albumId
        ? db.execute<{ artistId: string; coverId: string | null }>(
            sql`select c.artist_id as "artistId", l.artwork_asset_id as "coverId" from release_artist_credits c left join release_artwork_assets l on l.release_id=c.release_id and l.role='primary' and l.position=1 where c.release_id=${albumId}::uuid and c.position=1`,
          )
        : Promise.resolve(null),
    ]);
    const after = albumId ? await repository.publicationRevision(albumId) : null;
    if (before !== after) continue;
    if (albumId && !releases.some((r) => r.id === albumId))
      throw new Response("Release not found.", { status: 404 });
    return {
      identity,
      artists,
      releases,
      tracks,
      readiness,
      albumId,
      showQueue: !albumId,
      encodingAvailable,
      publicationRevision: after,
      preview: preview?.rows[0] ?? null,
    };
  }
  throw new Response("This release is changing. Reload before confirming publication.", {
    status: 503,
  });
}
function validId(id: unknown) {
  return typeof id === "string" && validateUuid(id, "id").ok;
}
export async function action({ request, context }: ActionFunctionArgs) {
  const { db, curator, identity } = await runtimeFor(request, context);
  const form = await request.formData();
  const intent = form.get("intent");
  const repository = createAlbumPublishingRepository(db);
  try {
    if (intent === "create-artist") {
      const title = String(form.get("title") ?? "").trim(),
        slug = String(form.get("slug") ?? "");
      if (
        !title ||
        title.length > 200 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
        slug.length > 200
      )
        throw new Error("Enter an artist name and a lowercase URL slug.");
      if (await curator.findBySlug("artist", slug))
        throw new Error(
          "Artist URL already exists. Choose that artist explicitly or use another URL.",
        );
      const artist = await curator.create("artist", { title, slug });
      return Response.json({ artistId: artist.id }, { headers: { "cache-control": "no-store" } });
    }
    const releaseId = String(form.get("releaseId") ?? "");
    if (!validId(releaseId)) throw new Error("Choose an album.");
    if (intent === "retry-preparation") {
      const trackId = String(form.get("trackId") ?? "");
      if (!validId(trackId)) throw new Error("Choose a track.");
      if (
        !(await repository.inventory()).some((t) => t.id === trackId && t.releaseId === releaseId)
      )
        throw new Error("This track is not awaiting preparation in this release.");
      await createReleasePreparationRepository(db).retry(trackId, identity);
    } else if (intent === "reorder") {
      const ids: unknown = JSON.parse(String(form.get("trackIds") ?? "null"));
      const previous: unknown = JSON.parse(String(form.get("previousTrackIds") ?? "null"));
      if (
        ![ids, previous].every(
          (value) =>
            Array.isArray(value) &&
            value.length > 0 &&
            value.length <= 100 &&
            value.every(validId) &&
            new Set(value).size === value.length,
        )
      )
        throw new Error("Refresh the release and choose every track once.");
      await repository.reorder(releaseId, ids as string[], previous as string[], identity);
    } else if (intent === "prepare") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(form.get("preparation")));
      } catch {
        throw new Error("Invalid album details. Save the album again.");
      }
      if (!parsed || typeof parsed !== "object")
        throw new Error("Enter album title, URL, artist and ordered tracks.");
      const input = parsed as AlbumPreparation;
      if (
        input.releaseId !== releaseId ||
        !validId(input.artistId) ||
        typeof input.title !== "string" ||
        !input.title.trim() ||
        input.title.length > 200 ||
        typeof input.slug !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) ||
        input.slug.length > 200 ||
        !Array.isArray(input.tracks)
      )
        throw new Error("Enter album title, URL, artist and ordered tracks.");
      if (
        input.tracks.length < 1 ||
        input.tracks.length > 100 ||
        new Set(input.tracks.map((t) => t?.id)).size !== input.tracks.length ||
        input.tracks.some(
          (t) =>
            !t ||
            !validId(t.id) ||
            typeof t.title !== "string" ||
            !t.title.trim() ||
            t.title.length > 200 ||
            typeof t.genre !== "string" ||
            t.genre.length > 100 ||
            (t.genres !== undefined &&
              (!validSelections(t.genres, GENRES) ||
                t.genre !== t.genres[0] ||
                !validSelections(t.moods, MOODS) ||
                !validSelections(t.processTags, PROCESS_TAGS))) ||
            ![t.moods, t.processTags].every(
              (values) =>
                Array.isArray(values) &&
                values.length <= 30 &&
                values.every(
                  (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 100,
                ),
            ),
        )
      )
        throw new Error("Invalid track metadata.");
      await repository.prepare(input, identity);
    } else if (intent === "cover") await repository.applyCover(releaseId, identity);
    else if (intent === "publish") {
      if (form.get("confirmed") !== "yes")
        throw new Error("Confirm publication of the complete album.");
      const blockers = await repository.readiness(releaseId);
      if (blockers.some((t) => t.blockers.length))
        return Response.json(
          { error: "Resolve the readiness blockers before publishing.", blockers },
          { status: 409 },
        );
      let expected: unknown;
      try {
        expected = JSON.parse(String(form.get("trackIds") ?? "null"));
      } catch {
        throw new Error("Refresh this release before publishing.");
      }
      if (
        !Array.isArray(expected) ||
        expected.length < 1 ||
        expected.length > 100 ||
        !expected.every(validId) ||
        new Set(expected).size !== expected.length
      )
        throw new Error("Refresh and confirm the complete track list before publishing.");
      const revision = form.get("publicationRevision");
      if (typeof revision !== "string" || !revision || revision.length > 50000)
        throw new Error("Refresh and confirm the current release details before publishing.");
      JSON.parse(revision);
      const slug = await repository.publish(releaseId, identity, expected as string[], revision);
      return Response.json(
        { albumId: releaseId, publicUrl: `/releases/${slug}` },
        { headers: { "cache-control": "no-store" } },
      );
    } else throw new Error("Unsupported album action.");
    return Response.json({ albumId: releaseId }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof Error && !("query" in error)
        ? error.message
        : "Album changed or metadata conflicts. Refresh readiness and retry; no partial album was published.";
    return Response.json(
      { error: message },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }
}

type PublishingRouteData = ReturnType<typeof useLoaderData<typeof loader>>;

function AlbumEditor({ data }: { data: PublishingRouteData }) {
  const fetcher = useFetcher<{ error?: string; publicUrl?: string }>();
  const revalidator = useRevalidator();
  const release = data.releases.find((r) => r.id === data.albumId)!;
  const tracks = data.tracks.filter((t) => t.releaseId === data.albumId);
  const preparing = tracks.some(
    (t) => t.preparationStatus === "queued" || t.preparationStatus === "processing",
  );
  useEffect(() => {
    if (!data.encodingAvailable || !preparing) return;
    const timer = setInterval(() => {
      if (revalidator.state === "idle") void revalidator.revalidate();
    }, 15000);
    return () => clearInterval(timer);
  }, [data.encodingAvailable, preparing, revalidator]);
  return (
    <PublishingWorkspace
      title={release.title}
      artistName={tracks[0]?.artistName ?? ""}
      releaseKind={tracks[0]?.releaseKind === "album" || tracks.length > 1 ? "album" : "single"}
      tracks={tracks}
      revisionKey={data.publicationRevision ?? undefined}
      coverPreviewUrl={
        tracks[0]?.submissionId && tracks[0]?.coverId
          ? `/curator/submissions/${tracks[0].submissionId}/artwork?v=${tracks[0].coverId}`
          : undefined
      }
      readiness={data.readiness}
      encodingAvailable={data.encodingAvailable}
      pending={fetcher.state !== "idle"}
      error={fetcher.data?.error}
      publicUrl={fetcher.data?.publicUrl}
      onPublish={() =>
        void fetcher.submit(
          {
            intent: "publish",
            releaseId: data.albumId!,
            confirmed: "yes",
            trackIds: JSON.stringify(tracks.map((t) => t.id)),
            publicationRevision: data.publicationRevision ?? "",
          },
          { method: "post" },
        )
      }
      onRetry={(trackId) =>
        void fetcher.submit(
          { intent: "retry-preparation", releaseId: data.albumId!, trackId },
          { method: "post" },
        )
      }
      onRefresh={() => void revalidator.revalidate()}
      onReorder={(ids) =>
        void fetcher.submit(
          {
            intent: "reorder",
            releaseId: data.albumId!,
            trackIds: JSON.stringify(ids),
            previousTrackIds: JSON.stringify(tracks.map((t) => t.id)),
          },
          { method: "post" },
        )
      }
      onSaveMetadata={(updated) =>
        void fetcher.submit(
          {
            intent: "prepare",
            releaseId: data.albumId!,
            preparation: JSON.stringify({
              releaseId: data.albumId!,
              artistId: tracks[0]?.artistId,
              title: release.title,
              slug: release.slug,
              tracks: updated,
            }),
          },
          { method: "post" },
        )
      }
    />
  );
}

export default function CuratorAlbumsRoute() {
  const data = useLoaderData<typeof loader>();
  const [query, setQuery] = useState("");
  const selected = data.releases.find((r) => r.id === data.albumId);
  const drafts = data.releases.filter(
    (r) =>
      ["draft", "in_review"].includes(r.lifecycleStatus) &&
      data.tracks.some((t) => t.releaseId === r.id && t.accepted) &&
      `${r.title} ${data.tracks.find((t) => t.releaseId === r.id)?.artistName ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <CuratorShell
      activeSection="collections"
      onSearch={data.showQueue ? setQuery : undefined}
      searchValue={query}
      searchPlaceholder="Find accepted releases or artists"
      identity={{
        name: data.identity.email,
        email: data.identity.email,
        initials: data.identity.email.slice(0, 2),
      }}
      navigation={[
        { id: "queue", label: "Submissions", href: "/curator/submissions" },
        {
          id: "collections",
          label: "Publishing queue",
          href: "/curator/albums",
          count: drafts.length,
        },
        { id: "settings", label: "Advanced catalogue", href: "/curator" },
      ]}
    >
      {data.showQueue ? (
        <>
          <header className="curator-page-heading">
            <div>
              <p className="curator-overline">Accepted · awaiting publication</p>
              <h1>Publishing queue</h1>
              <p>Keep curating first. Every accepted draft waits here until you are ready.</p>
            </div>
          </header>
          <div className="publishing-drafts">
            {drafts.map((release) => {
              const tracks = data.tracks.filter((t) => t.releaseId === release.id);
              return (
                <CuratorPanel key={release.id}>
                  <CuratorBadge tone="success">Accepted</CuratorBadge>
                  <h2>{release.title}</h2>
                  <p>
                    {tracks[0]?.artistName} · {tracks.length} track{tracks.length === 1 ? "" : "s"}
                  </p>
                  <p>
                    {tracks.filter((t) => t.preparationStatus === "ready").length} of{" "}
                    {tracks.length} streaming files ready
                  </p>
                  <Link
                    className="curator-button curator-button--primary"
                    to={`?album=${release.id}`}
                  >
                    Open preparation →
                  </Link>
                </CuratorPanel>
              );
            })}
          </div>
          {!drafts.length ? (
            <CuratorPanel className="publishing-complete">
              <h2>{query ? "No matching releases" : "No releases waiting"}</h2>
              <p>
                {query
                  ? "Try another title or artist."
                  : "Accepted music appears here automatically."}
              </p>
              <Link to="/curator/submissions">Continue curating →</Link>
            </CuratorPanel>
          ) : null}
        </>
      ) : (
        <>
          <nav className="publishing-back">
            <Link to="/curator/albums">← Publishing queue</Link>
          </nav>
          {selected?.lifecycleStatus === "published" ? (
            <CuratorPanel className="publishing-complete">
              <CuratorBadge tone="success">Published</CuratorBadge>
              <h1>{selected.title}</h1>
              <Link to={`/releases/${selected.slug}`}>Open published release →</Link>
            </CuratorPanel>
          ) : (
            <AlbumEditor key={data.albumId ?? "new"} data={data} />
          )}
        </>
      )}
    </CuratorShell>
  );
}
