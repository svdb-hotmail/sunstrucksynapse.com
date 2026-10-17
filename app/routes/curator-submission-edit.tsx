import {
  redirect,
  useFetcher,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { COVER_MAX_BYTES } from "~/config/music-metadata";
import { createSubmissionEditRepository } from "~/repositories/submission-edit.server";
import { storeCuratorArtwork } from "~/services/curator-artwork.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { validateUuid } from "~/services/curator-validation";
import { validateEditorialFields, type SubmissionEditorialFields } from "~/types/submission-edit";
import { CuratorShell } from "~/features/curator-workspace/CuratorShell";
import { SubmissionEditor } from "~/features/curator-workspace/SubmissionEditor";

async function runtimeFor(
  request: Request,
  context: LoaderFunctionArgs["context"],
  id: string | undefined,
) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) throw auth.response;
  if (!id || !validateUuid(id, "submission").ok) throw new Response("Not found.", { status: 404 });
  if (!runtime.db || !runtime.env) throw new Response("Editing unavailable.", { status: 503 });
  return { ...runtime, db: runtime.db, env: runtime.env, identity: auth.identity, id };
}
export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const runtime = await runtimeFor(request, context, params.submissionId);
  const row = await createSubmissionEditRepository(runtime.db).find(runtime.id);
  if (!row) throw new Response("Not found.", { status: 404 });
  if (new URL(request.url).searchParams.get("cover") === "1") {
    if (!row.coverId) throw new Response("Not found.", { status: 404 });
    // Old open tabs may still request this URL. Page loaders render HTML;
    // redirect image requests to a resource route instead of returning bytes.
    return redirect(`/curator/submissions/${row.id}/artwork?v=${row.coverId}`, {
      status: 307,
      headers: { "cache-control": "private, no-store" },
    });
  }
  return {
    identity: runtime.identity,
    data: {
      id: row.id,
      reference: row.reference,
      status: row.status,
      artistName: row.artistName,
      trackId: row.trackId,
      releaseId: row.releaseId,
      fields: row.fields,
      revision: JSON.stringify(row.revision),
      editable: row.editable,
      discoveryEditable: row.discoveryEditable,
      releaseFieldsEditable: row.releaseFieldsEditable,
      coverUrl: row.coverId ? `/curator/submissions/${row.id}/artwork?v=${row.coverId}` : null,
    },
  };
}
export async function action({ request, context, params }: ActionFunctionArgs) {
  const runtime = await runtimeFor(request, context, params.submissionId);
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Open the curator editor on this site before saving." },
      { status: 403 },
    );
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length < 1 || length > COVER_MAX_BYTES + 65536)
    return Response.json(
      { error: "The upload must have a known size, up to 20 MiB." },
      { status: 413 },
    );
  try {
    const form = await request.formData();
    const reason = String(form.get("reason") ?? "").trim();
    if (reason.length < 3 || reason.length > 1000)
      throw new Error("Give a reason for this correction (3–1000 characters).");
    const revision = String(form.get("revision") ?? "");
    JSON.parse(revision);
    const repository = createSubmissionEditRepository(runtime.db);
    const current = await repository.find(runtime.id);
    if (!current?.editable && !current?.discoveryEditable)
      throw new Error("This submission is read-only.");
    if (JSON.stringify(current.revision) !== revision)
      throw new Error("This submission changed. Reload the editor before saving.");
    const cover = form.get("cover");
    if (!current.editable && cover instanceof File && cover.size)
      throw new Error("Only genres, moods and process tags can be corrected for this track.");
    const protectedNames: ("title" | "releaseTitle" | "summary")[] = !current.editable
      ? ["title", "releaseTitle", "summary"]
      : current.releaseFieldsEditable === false
        ? ["releaseTitle", "summary"]
        : [];
    const protectedFields: Partial<
      Pick<SubmissionEditorialFields, "title" | "releaseTitle" | "summary">
    > = {};
    for (const name of protectedNames) {
      const submitted = form.get(name);
      // Native text inputs strip line breaks; textareas and multipart bodies
      // use different newline representations. Preserve every stored byte after
      // comparing the browser's representation, before trimming/length validation.
      const browserText = (value: string) =>
        name === "summary" ? value.replace(/\r\n?/g, "\n") : value.replace(/[\r\n]/g, "");
      if (
        typeof submitted !== "string" ||
        browserText(submitted) !== browserText(current.fields[name])
      )
        throw new Error(
          !current.editable
            ? "Only genres, moods and process tags can be corrected for this track."
            : "Release title and description are read-only until this track is accepted.",
        );
      protectedFields[name] = current.fields[name];
    }
    const summary = form.get("summary");
    const fields = {
      ...validateEditorialFields({
        title: form.get("title"),
        releaseTitle: form.get("releaseTitle"),
        summary: typeof summary === "string" ? summary.replace(/\r\n?/g, "\n") : summary,
        genres: form.getAll("genres"),
        moods: form.getAll("moods"),
        processTags: form.getAll("processTags"),
        ...protectedFields,
      }),
      ...protectedFields,
    };
    if (
      !current.editable &&
      (!fields.genres.length || !fields.moods.length || !fields.processTags.length)
    )
      throw new Error("Choose at least one genre, mood and process tag for this track.");
    if (cover instanceof File && cover.size && form.get("artworkPermission") !== "yes")
      throw new Error("Confirm permission to publish the artwork.");
    const artwork =
      cover instanceof File && cover.size
        ? await storeCuratorArtwork(cover, runtime.env)
        : undefined;
    // Never delete a possible selected object after an unknown transaction outcome.
    const saved = await repository.save(
      runtime.id,
      revision,
      fields,
      reason,
      runtime.identity,
      artwork,
    );
    return Response.json(
      {
        savedRevision: JSON.stringify(saved!.revision),
        savedCoverUrl: saved!.coverId
          ? `/curator/submissions/${saved!.id}/artwork?v=${saved!.coverId}`
          : null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && !("query" in error) && !(error instanceof SyntaxError)
            ? error.message
            : "The submission changed or could not be saved. Reload and retry; your accepted review is preserved.",
      },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }
}
export default function CuratorSubmissionEditRoute() {
  const loaded = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{
    error?: string;
    savedRevision?: string;
    savedCoverUrl?: string | null;
  }>();
  return (
    <CuratorShell
      activeSection="queue"
      identity={{
        name: loaded.identity.email,
        email: loaded.identity.email,
        initials: loaded.identity.email.slice(0, 2),
      }}
      navigation={[
        { id: "queue", label: "Submissions", href: "/curator/submissions" },
        { id: "catalogue", label: "Catalogue", href: "/curator" },
        { id: "collections", label: "Release preparation", href: "/curator/albums" },
      ]}
    >
      <SubmissionEditor
        key={loaded.data.id}
        data={loaded.data}
        pending={fetcher.state !== "idle"}
        error={fetcher.data?.error}
        savedRevision={fetcher.data?.savedRevision}
        savedCoverUrl={fetcher.data?.savedCoverUrl}
        onSave={(form) => {
          void fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
        }}
      />
    </CuratorShell>
  );
}
