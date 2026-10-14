import { sql } from "drizzle-orm";
import { useCallback, useEffect, useState } from "react";
import {
  Link,
  useFetcher,
  useLoaderData,
  useNavigate,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { validateUuid } from "~/services/curator-validation";
import {
  createAlbumPublishingRepository,
  type AlbumPreparation,
  type AlbumTrackInput,
} from "~/repositories/album-publishing.server";
import { PublicMediaUpload } from "~/components/PublicMediaUpload";
import { CuratorShell } from "~/features/curator-workspace/CuratorShell";

async function runtimeFor(request: Request, context: LoaderFunctionArgs["context"]) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) throw auth.response;
  if (!runtime.db || !runtime.curatorRepository)
    throw new Response("Album service unavailable.", { status: 503 });
  return { db: runtime.db, curator: runtime.curatorRepository, identity: auth.identity };
}
export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, curator, identity } = await runtimeFor(request, context);
  const repository = createAlbumPublishingRepository(db);
  const selected = new URL(request.url).searchParams.get("album");
  const albumId = selected && validateUuid(selected, "album").ok ? selected : null;
  const [artists, releases, tracks, readiness] = await Promise.all([
    curator.list("artist"),
    curator.list("release"),
    repository.inventory(),
    albumId ? repository.readiness(albumId) : Promise.resolve([]),
  ]);
  if (albumId && !releases.some((r) => r.id === albumId))
    throw new Response("Album not found.", { status: 404 });
  const preview = albumId
    ? await db.execute<{ artistId: string; coverId: string | null }>(
        sql`select c.artist_id as "artistId", l.artwork_asset_id as "coverId" from release_artist_credits c left join release_artwork_assets l on l.release_id=c.release_id and l.role='primary' and l.position=1 where c.release_id=${albumId}::uuid and c.position=1`,
      )
    : null;
  return {
    identity,
    artists,
    releases,
    tracks,
    readiness,
    albumId,
    preview: preview?.rows[0] ?? null,
  };
}
function urlSlug(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200)
    .replace(/-$/g, "");
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
    if (intent === "prepare") {
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
      const slug = await repository.publish(releaseId, identity);
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

export function AlbumEditor({ data }: { data: ReturnType<typeof useLoaderData<typeof loader>> }) {
  const fetcher = useFetcher<{
    error?: string;
    albumId?: string;
    publicUrl?: string;
    artistId?: string;
  }>();
  const navigate = useNavigate();
  const artist = useFetcher<{ error?: string; artistId?: string }>();
  const [newArtistName, setNewArtistName] = useState("");
  const [newArtistSlug, setNewArtistSlug] = useState("");
  const initial = data.releases.find((r) => r.id === data.albumId);
  const [releaseId] = useState(() => data.albumId ?? crypto.randomUUID());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [artistId, setArtistId] = useState(data.preview?.artistId ?? "");
  const [selected, setSelected] = useState<AlbumTrackInput[]>(() =>
    data.tracks.filter((t) => t.releaseId === data.albumId),
  );
  const [sharedGenre, setSharedGenre] = useState("");
  const [sharedMoods, setSharedMoods] = useState("");
  const [sharedProcess, setSharedProcess] = useState("");
  const [metadataNotice, setMetadataNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [activeUploads, setActiveUploads] = useState<string[]>([]);
  const reportUpload = useCallback((id: string, active: boolean) => {
    setActiveUploads((ids) =>
      active ? [...new Set([...ids, id])] : ids.filter((value) => value !== id),
    );
  }, []);
  const busy = fetcher.state !== "idle" || artist.state !== "idle" || activeUploads.length > 0;
  useEffect(() => {
    if (artist.state === "idle" && artist.data?.artistId) setArtistId(artist.data.artistId);
  }, [artist.state, artist.data]);
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.albumId && !data.albumId) {
      navigate(`?album=${fetcher.data.albumId}`, { replace: true });
    }
  }, [fetcher.state, fetcher.data, data.albumId, navigate]);
  const trackSignature = (tracks: AlbumTrackInput[]) =>
    JSON.stringify(
      tracks.map((t) => ({
        id: t.id,
        title: t.title,
        genre: (t.genre ?? "").trim(),
        moods: t.moods,
        processTags: t.processTags,
      })),
    );
  const unsaved =
    title !== (initial?.title ?? "") ||
    slug !== (initial?.slug ?? "") ||
    artistId !== (data.preview?.artistId ?? "") ||
    trackSignature(selected) !==
      trackSignature(data.tracks.filter((t) => t.releaseId === data.albumId));
  const albumId = data.albumId ?? fetcher.data?.albumId;
  const save = () =>
    void fetcher.submit(
      {
        intent: "prepare",
        releaseId,
        preparation: JSON.stringify({ releaseId, artistId, title, slug, tracks: selected }),
      },
      { method: "post" },
    );
  const split = (v: string) =>
    v
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  const update = (id: string, values: Partial<AlbumTrackInput>) =>
    setSelected((rows) => rows.map((row) => (row.id === id ? { ...row, ...values } : row)));
  return (
    <>
      {artist.data?.error ? <p role="alert">{artist.data.error}</p> : null}
      {fetcher.data?.error ? <p role="alert">{fetcher.data.error}</p> : null}
      {fetcher.data?.publicUrl ? (
        <p role="status">
          Published: <a href={fetcher.data.publicUrl}>{fetcher.data.publicUrl}</a>
        </p>
      ) : null}
      <section className="curator-panel">
        <h2>Album essentials</h2>
        <label>
          Title
          <input
            value={title}
            disabled={busy}
            onChange={(e) => {
              const next = e.currentTarget.value;
              if (!slug || slug === urlSlug(title)) setSlug(urlSlug(next));
              setTitle(next);
            }}
            maxLength={200}
          />
        </label>
        <label>
          Album URL slug
          <input
            value={slug}
            disabled={busy}
            onChange={(e) => setSlug(e.currentTarget.value)}
            maxLength={200}
          />
        </label>
        <label>
          Primary artist
          <select
            value={artistId}
            disabled={busy}
            onChange={(e) => setArtistId(e.currentTarget.value)}
          >
            <option value="">Choose deliberately</option>
            {data.artists
              .filter((a) => ["draft", "in_review", "published"].includes(a.lifecycleStatus))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} · {a.slug}
                </option>
              ))}
          </select>
        </label>
        <details>
          <summary>Create an artist</summary>
          <artist.Form method="post">
            <input type="hidden" name="intent" value="create-artist" />
            <label>
              Name
              <input
                name="title"
                required
                maxLength={200}
                value={newArtistName}
                disabled={busy}
                onChange={(e) => {
                  const next = e.currentTarget.value;
                  if (!newArtistSlug || newArtistSlug === urlSlug(newArtistName))
                    setNewArtistSlug(urlSlug(next));
                  setNewArtistName(next);
                }}
              />
            </label>
            <label>
              URL slug
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={200}
                value={newArtistSlug}
                disabled={busy}
                onChange={(e) => setNewArtistSlug(e.currentTarget.value)}
              />
            </label>
            <button disabled={busy}>Create artist</button>
          </artist.Form>
        </details>
      </section>
      <section className="curator-panel">
        <h2>Select accepted tracks</h2>
        <p>
          One submission per track for this launch. Accepted declarations and review links stay
          pinned.
        </p>
        {data.albumId ? (
          <p>Saved tracks stay in this album. Add more tracks or adjust their order below.</p>
        ) : null}
        {data.tracks
          .filter((t) => t.accepted)
          .map((t) => (
            <label key={t.id}>
              <input
                type="checkbox"
                disabled={busy || (Boolean(data.albumId) && t.releaseId === data.albumId)}
                checked={selected.some((s) => s.id === t.id)}
                onChange={(e) =>
                  setSelected((rows) =>
                    e.target.checked ? [...rows, t] : rows.filter((row) => row.id !== t.id),
                  )
                }
              />
              {t.title}
              {t.artistName ? ` — ${t.artistName}` : ""}
            </label>
          ))}
        <details>
          <summary>Set shared discovery metadata</summary>
          <label>
            Shared genre
            <input
              value={sharedGenre}
              maxLength={100}
              onChange={(e) => setSharedGenre(e.currentTarget.value)}
              disabled={busy}
            />
          </label>
          <label>
            Shared moods (comma separated)
            <input
              value={sharedMoods}
              onChange={(e) => setSharedMoods(e.currentTarget.value)}
              disabled={busy}
            />
          </label>
          <label>
            Shared process tags (comma separated)
            <input
              value={sharedProcess}
              onChange={(e) => setSharedProcess(e.currentTarget.value)}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            disabled={
              busy ||
              !selected.length ||
              !sharedGenre.trim() ||
              !split(sharedMoods).length ||
              !split(sharedProcess).length
            }
            onClick={() => {
              setSelected((tracks) =>
                tracks.map((track) => ({
                  ...track,
                  genre: sharedGenre.trim(),
                  moods: split(sharedMoods),
                  processTags: split(sharedProcess),
                })),
              );
              setMetadataNotice(
                "Shared metadata applied. Save the album to keep these changes; you can adjust each track below.",
              );
            }}
          >
            Apply shared metadata to selected tracks
          </button>
          {metadataNotice ? <p role="status">{metadataNotice}</p> : null}
        </details>
        <ol>
          {selected.map((track, index) => (
            <li key={track.id}>
              <label>
                Track title
                <input
                  disabled={busy}
                  value={track.title}
                  onChange={(e) => update(track.id, { title: e.currentTarget.value })}
                />
              </label>
              <label>
                Genre
                <input
                  disabled={busy}
                  value={track.genre ?? ""}
                  onChange={(e) => update(track.id, { genre: e.currentTarget.value })}
                />
              </label>
              <label>
                Moods (comma separated)
                <input
                  disabled={busy}
                  key={JSON.stringify(track.moods)}
                  defaultValue={track.moods.join(", ")}
                  onBlur={(e) => update(track.id, { moods: split(e.currentTarget.value) })}
                />
              </label>
              <label>
                Process tags (comma separated)
                <input
                  disabled={busy}
                  key={JSON.stringify(track.processTags)}
                  defaultValue={track.processTags.join(", ")}
                  onBlur={(e) => update(track.id, { processTags: split(e.currentTarget.value) })}
                />
              </label>
              <button
                type="button"
                disabled={busy || index === 0}
                onClick={() =>
                  setSelected((rows) => {
                    const next = [...rows];
                    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                    return next;
                  })
                }
              >
                Move up
              </button>
              <button
                type="button"
                disabled={busy || index === selected.length - 1}
                onClick={() =>
                  setSelected((rows) => {
                    const next = [...rows];
                    [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
                    return next;
                  })
                }
              >
                Move down
              </button>
              {data.tracks.find((t) => t.id === track.id)?.publicAudioReady ? (
                <p role="status">
                  Public listening file ready. Selecting another file replaces the public listening
                  asset.
                </p>
              ) : null}
              {albumId ? (
                <PublicMediaUpload
                  kind="audio"
                  disabled={busy}
                  onBusyChange={(active) => reportUpload(track.id, active)}
                  targetId={track.id}
                  label={`Public listening file for ${track.title}`}
                />
              ) : null}
            </li>
          ))}
        </ol>
        <button disabled={busy || !artistId || !selected.length} onClick={save}>
          Save album & order
        </button>
        {fetcher.data?.albumId && !data.albumId ? (
          <Link to={`?album=${fetcher.data.albumId}`}>Continue with cover and readiness</Link>
        ) : null}
      </section>
      {data.albumId ? (
        <section className="curator-panel">
          <h2>Cover & readiness</h2>
          <details>
            <summary>Public presentation preview</summary>
            {data.preview?.coverId ? (
              <img
                src={`/media/artwork/${data.preview.coverId}`}
                alt={`${title} album cover`}
                width={240}
              />
            ) : null}
            <h3>{title}</h3>
            <p>{data.artists.find((a) => a.id === artistId)?.title}</p>
            <ol>
              {selected.map((t) => (
                <li key={t.id}>
                  {t.title} · {t.genre} · {t.moods.join(", ")}
                </li>
              ))}
            </ol>
          </details>
          <PublicMediaUpload
            kind="artwork"
            disabled={busy}
            onBusyChange={(active) => reportUpload("album-cover", active)}
            targetId={data.albumId}
            label="One public album cover"
          />
          <button
            disabled={busy}
            onClick={() =>
              void fetcher.submit({ intent: "cover", releaseId: data.albumId! }, { method: "post" })
            }
          >
            Apply album cover to all draft tracks
          </button>
          <ul>
            {data.readiness.map((row) => (
              <li key={row.id}>
                <strong>{row.title}</strong>
                {row.blockers.length ? (
                  <ul>
                    {row.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : (
                  " — Ready"
                )}
              </li>
            ))}
          </ul>
          {unsaved ? <p role="status">Save album changes before publishing.</p> : null}
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.currentTarget.checked)}
            />
            Publish this complete album for public listening
          </label>
          <button
            disabled={
              busy ||
              unsaved ||
              !confirmed ||
              !data.readiness.length ||
              data.readiness.some((r) => r.blockers.length)
            }
            onClick={() =>
              void fetcher.submit(
                { intent: "publish", releaseId: data.albumId!, confirmed: "yes" },
                { method: "post" },
              )
            }
          >
            Publish album
          </button>
        </section>
      ) : null}
    </>
  );
}
export default function CuratorAlbumsRoute() {
  const data = useLoaderData<typeof loader>();
  return (
    <CuratorShell
      activeSection="collections"
      identity={{
        name: data.identity.email,
        email: data.identity.email,
        initials: data.identity.email.slice(0, 2),
      }}
      navigation={[
        { id: "queue", label: "Submissions", href: "/curator/submissions" },
        { id: "collections", label: "Album preparation", href: "/curator/albums" },
        { id: "settings", label: "Catalogue", href: "/curator" },
      ]}
    >
      <h1>Prepare & publish an album</h1>
      <nav>
        <Link to="/curator/albums">New album</Link>
        {data.releases
          .filter((r) => r.lifecycleStatus === "draft" || r.lifecycleStatus === "in_review")
          .map((r) => (
            <Link key={r.id} to={`?album=${r.id}`}>
              {r.title}
            </Link>
          ))}
      </nav>
      {data.releases.find((r) => r.id === data.albumId)?.lifecycleStatus === "published" ? (
        <section className="curator-panel" role="status">
          <h2>Album published</h2>
          <p>
            This release is available for public listening. Its publication and review history are
            retained.
          </p>
          <Link to={`/releases/${data.releases.find((r) => r.id === data.albumId)!.slug}`}>
            Open published album
          </Link>
        </section>
      ) : (
        <AlbumEditor key={data.albumId ?? "new"} data={data} />
      )}
    </CuratorShell>
  );
}
