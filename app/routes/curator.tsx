import { useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import type {
  CuratorCollectionItem,
  CuratorEntity,
  CuratorEntityType,
  Lifecycle,
} from "~/repositories/curator.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { CuratorService, curatorHttpStatus } from "~/services/curator.server";
import { validateCatalogueForm, validateReason, validateUuid } from "~/services/curator-validation";

const entityTypes = ["artist", "release", "track", "collection"] as const;
const lifecycleTransitions: Readonly<Record<Lifecycle, readonly Lifecycle[]>> = {
  draft: ["in_review"],
  in_review: ["scheduled"],
  scheduled: ["published"],
  published: ["archived"],
  archived: [],
};

function entityType(value: FormDataEntryValue | null): CuratorEntityType | null {
  return typeof value === "string" && entityTypes.includes(value as (typeof entityTypes)[number])
    ? (value as CuratorEntityType)
    : null;
}

async function curatorRuntime(request: Request, context: LoaderFunctionArgs["context"]) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) throw auth.response;
  if (!runtime.curatorRepository) {
    throw new Response("Curator service unavailable.", { status: 503 });
  }
  return { runtime, identity: auth.identity };
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { runtime, identity } = await curatorRuntime(request, context);
  const repository = runtime.curatorRepository!;
  const [artists, releases, tracks, collections, audit] = await Promise.all([
    repository.list("artist"),
    repository.list("release"),
    repository.list("track"),
    repository.list("collection"),
    repository.listAudit(),
  ]);
  const collectionItems: Record<string, CuratorCollectionItem[]> = Object.fromEntries(
    await Promise.all(
      collections.map(async (collection) => [
        collection.id,
        await repository.listCollectionItems(collection.id),
      ]),
    ),
  );
  return { identity, artists, releases, tracks, collections, collectionItems, audit };
}

function error(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { runtime, identity } = await curatorRuntime(request, context);
  const repository = runtime.curatorRepository!;
  const service = new CuratorService(repository);
  const form = await request.formData();
  const intent = form.get("intent");
  const type = entityType(form.get("entityType"));

  if (intent === "publish-scheduled") {
    const count = await service.publishScheduled();
    return redirect(`/curator?published=${count}`);
  }
  if (!type) return error("Choose a valid catalogue type.");

  if (intent === "create") {
    const validated = validateCatalogueForm(form);
    if (!validated.ok) return error(Object.values(validated.fieldErrors)[0] ?? "Invalid form.");
    const position = Number(form.get("position"));
    const result = await service.create(type, {
      ...validated.value,
      artistId: typeof form.get("artistId") === "string" ? String(form.get("artistId")) : undefined,
      releaseId:
        typeof form.get("releaseId") === "string" ? String(form.get("releaseId")) : undefined,
      position: Number.isSafeInteger(position) ? position : undefined,
    });
    return result.ok
      ? redirect("/curator?created=1")
      : error(result.error.message, curatorHttpStatus(result.error.code));
  }

  const idResult = validateUuid(form.get("entityId"));
  if (!idResult.ok) return error(idResult.fieldErrors.id);
  const id = idResult.value;

  if (intent === "update") {
    const validated = validateCatalogueForm(form);
    if (!validated.ok) return error(Object.values(validated.fieldErrors)[0] ?? "Invalid form.");
    const result = await service.update(type, id, validated.value);
    return result.ok
      ? redirect("/curator?updated=1")
      : error(result.error.message, curatorHttpStatus(result.error.code));
  }
  if (intent === "delete") {
    const result = await service.delete(type, id);
    return result.ok
      ? redirect("/curator?deleted=1")
      : error(result.error.message, curatorHttpStatus(result.error.code));
  }
  if (intent === "transition") {
    const to = form.get("to");
    if (
      typeof to !== "string" ||
      !["draft", "in_review", "scheduled", "published", "archived"].includes(to)
    ) {
      return error("Choose a valid lifecycle state.");
    }
    const reasonValue = form.get("reason");
    const needsReason = to === "published" || to === "archived";
    const reason = needsReason ? validateReason(reasonValue) : null;
    if (reason && !reason.ok) return error(reason.fieldErrors.reason);
    const scheduledValue = form.get("scheduledFor");
    const result = await service.transition(type, id, to as Lifecycle, identity, {
      reason: reason?.ok ? reason.value : undefined,
      scheduledFor:
        typeof scheduledValue === "string" && scheduledValue ? new Date(scheduledValue) : undefined,
    });
    return result.ok
      ? redirect("/curator?transitioned=1")
      : error(result.error.message, curatorHttpStatus(result.error.code));
  }
  if (type === "collection" && intent === "configure-homepage") {
    const show = form.get("showOnHomepage") === "on";
    const position = Number(form.get("homepagePosition"));
    if (show && (!Number.isSafeInteger(position) || position < 1)) {
      return error("Homepage collections require a positive position.");
    }
    if (show && (await repository.homepagePositionInUse(id, position))) {
      return error("That homepage position is already in use.", 409);
    }
    const changed = await repository.configureCollectionHomepage(id, show, show ? position : null);
    return changed ? redirect("/curator?configured=1") : error("Collection not found.", 404);
  }
  if (type === "collection" && intent === "add-item") {
    const trackId = validateUuid(form.get("trackId"), "trackId");
    if (!trackId.ok) return error(trackId.fieldErrors.trackId);
    const result = await service.addCollectionItem(id, { trackId: trackId.value });
    return result.ok
      ? redirect("/curator?item-added=1")
      : error(result.error.message, curatorHttpStatus(result.error.code));
  }
  if (type === "collection" && intent === "move-item") {
    const itemResult = validateUuid(form.get("itemId"), "itemId");
    if (!itemResult.ok) return error(itemResult.fieldErrors.itemId);
    const direction = form.get("direction") === "up" ? -1 : 1;
    const items = await repository.listCollectionItems(id);
    const index = items.findIndex((item) => item.id === itemResult.value);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
      return error("The collection item cannot move further.");
    }
    const itemIds = items.map((item) => item.id);
    [itemIds[index], itemIds[nextIndex]] = [itemIds[nextIndex], itemIds[index]];
    const result = await service.reorderCollection(id, itemIds);
    return result.ok
      ? redirect("/curator?reordered=1")
      : error(result.error.message, curatorHttpStatus(result.error.code));
  }
  if (type === "collection" && intent === "remove-item") {
    const itemResult = validateUuid(form.get("itemId"), "itemId");
    if (!itemResult.ok) return error(itemResult.fieldErrors.itemId);
    const removed = await repository.removeCollectionItem(id, itemResult.value);
    return removed ? redirect("/curator?item-removed=1") : error("Collection item not found.", 404);
  }
  return error("Unsupported curator operation.");
}

function EntityCreateForm({
  type,
  artists,
  releases,
}: {
  type: CuratorEntityType;
  artists: CuratorEntity[];
  releases: CuratorEntity[];
}) {
  return (
    <Form method="post" className="curator-form">
      <input type="hidden" name="intent" value="create" />
      <input type="hidden" name="entityType" value={type} />
      <label>
        Title
        <input name="title" required maxLength={200} />
      </label>
      <label>
        Slug
        <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
      </label>
      {type === "release" || type === "track" ? (
        <label>
          Primary artist
          <select name="artistId" required defaultValue="">
            <option value="" disabled>
              Select artist
            </option>
            {artists.map((artist) => (
              <option value={artist.id} key={artist.id}>
                {artist.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {type === "track" ? (
        <>
          <label>
            Release
            <select name="releaseId" required defaultValue="">
              <option value="" disabled>
                Select release
              </option>
              {releases.map((release) => (
                <option value={release.id} key={release.id}>
                  {release.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Position
            <input name="position" type="number" min={1} required />
          </label>
        </>
      ) : null}
      <button type="submit">Create {type}</button>
    </Form>
  );
}

function EntityEditor({ type, entity }: { type: CuratorEntityType; entity: CuratorEntity }) {
  return (
    <article className="curator-record">
      <Form method="post" className="curator-form">
        <input type="hidden" name="intent" value="update" />
        <input type="hidden" name="entityType" value={type} />
        <input type="hidden" name="entityId" value={entity.id} />
        <label>
          Title
          <input name="title" required maxLength={200} defaultValue={entity.title} />
        </label>
        <label>
          Slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            defaultValue={entity.slug}
          />
        </label>
        <button type="submit">Save</button>
      </Form>
      <p>
        Status: <strong>{entity.lifecycleStatus}</strong>
      </p>
      <div className="curator-actions">
        {lifecycleTransitions[entity.lifecycleStatus].map((to) => (
          <Form method="post" key={to}>
            <input type="hidden" name="intent" value="transition" />
            <input type="hidden" name="entityType" value={type} />
            <input type="hidden" name="entityId" value={entity.id} />
            <input type="hidden" name="to" value={to} />
            {to === "scheduled" ? (
              <input
                aria-label="Schedule time"
                type="datetime-local"
                name="scheduledFor"
                required
              />
            ) : null}
            {to === "published" || to === "archived" ? (
              <input aria-label={`${to} reason`} name="reason" required maxLength={1000} />
            ) : null}
            <button type="submit">Move to {to.replace("_", " ")}</button>
          </Form>
        ))}
        <Form
          method="post"
          onSubmit={(event) => {
            if (!window.confirm(`Delete ${entity.title}? This cannot be undone.`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="entityType" value={type} />
          <input type="hidden" name="entityId" value={entity.id} />
          <button type="submit" className="danger">
            Delete
          </button>
        </Form>
      </div>
    </article>
  );
}

async function responseError(response: Response, fallback: string) {
  const value: unknown = await response.json();
  return typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "error") === "string"
    ? String(Reflect.get(value, "error"))
    : fallback;
}

function MediaUpload({ tracks }: { tracks: CuratorEntity[] }) {
  const [status, setStatus] = useState("");

  async function upload(form: HTMLFormElement) {
    const values = new FormData(form);
    const file = values.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setStatus("Choose a file.");
      return;
    }
    setStatus("Preparing upload…");
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksumSha256 = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const kind = String(values.get("kind"));
    const declaration = {
      kind,
      scope: String(values.get("scope")),
      mimeType: file.type,
      byteSize: file.size,
      checksumSha256,
      targetEntityId: kind === "audio" ? String(values.get("trackId")) : undefined,
      width: kind === "artwork" ? Number(values.get("width")) : undefined,
      height: kind === "artwork" ? Number(values.get("height")) : undefined,
      durationMs: kind === "audio" ? Number(values.get("durationMs")) : undefined,
      codec: kind === "audio" ? String(values.get("codec")) : undefined,
    };
    const created = await fetch("/curator/api/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(declaration),
    });
    if (!created.ok) {
      setStatus(await responseError(created, "Upload session failed."));
      return;
    }
    const session: { id: string } = await created.json();
    const stored = await fetch(`/curator/api/uploads/${session.id}`, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: bytes,
    });
    if (!stored.ok) {
      setStatus(await responseError(stored, "Upload failed."));
      return;
    }
    const completed = await fetch(`/curator/api/uploads/${session.id}`, { method: "PATCH" });
    setStatus(completed.ok ? "Upload completed." : "Upload could not be completed.");
  }

  return (
    <form
      className="curator-form"
      onSubmit={(event) => {
        event.preventDefault();
        void upload(event.currentTarget);
      }}
    >
      <label>
        Asset kind
        <select name="kind">
          <option value="artwork">Artwork</option>
          <option value="audio">Prepared audio</option>
        </select>
      </label>
      <label>
        Scope
        <select name="scope">
          <option value="publishable_derivative">Public derivative</option>
          <option value="private_master">Private master</option>
        </select>
      </label>
      <label>
        Track (audio)
        <select name="trackId" defaultValue="">
          <option value="">Not applicable</option>
          {tracks.map((track) => (
            <option value={track.id} key={track.id}>
              {track.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Width (artwork)
        <input name="width" type="number" min={1} />
      </label>
      <label>
        Height (artwork)
        <input name="height" type="number" min={1} />
      </label>
      <label>
        Duration ms (audio)
        <input name="durationMs" type="number" min={1} />
      </label>
      <label>
        Codec (audio)
        <input name="codec" />
      </label>
      <label>
        File
        <input name="file" type="file" required />
      </label>
      <button type="submit">Upload directly to managed storage</button>
      <p role="status">{status}</p>
    </form>
  );
}

export default function CuratorWorkspace() {
  const data = useLoaderData<typeof loader>();
  const actionData: unknown = useActionData();
  const actionError =
    typeof actionData === "object" &&
    actionData !== null &&
    typeof Reflect.get(actionData, "error") === "string"
      ? String(Reflect.get(actionData, "error"))
      : null;
  const navigation = useNavigation();
  const groups = {
    artist: data.artists,
    release: data.releases,
    track: data.tracks,
    collection: data.collections,
  };

  return (
    <main className="curator-workspace">
      <header className="curator-header">
        <div>
          <p className="eyebrow">Private workspace</p>
          <h1>Catalogue curator</h1>
          <p>Signed in as {data.identity.email}</p>
        </div>
        <Link to="/">Public catalogue</Link>
      </header>
      {actionError ? <p role="alert">{actionError}</p> : null}
      {navigation.state !== "idle" ? <p role="status">Saving changes…</p> : null}

      {entityTypes.map((type) => (
        <section className="curator-section" key={type}>
          <h2>{type[0].toUpperCase() + type.slice(1)} management</h2>
          <EntityCreateForm type={type} artists={data.artists} releases={data.releases} />
          <div className="curator-grid">
            {groups[type].map((entity) => (
              <EntityEditor type={type} entity={entity} key={entity.id} />
            ))}
          </div>
        </section>
      ))}

      <section className="curator-section">
        <h2>Editorial shelves</h2>
        {data.collections.map((collection) => (
          <article className="curator-record" key={collection.id}>
            <h3>{collection.title}</h3>
            <Form method="post" className="curator-form">
              <input type="hidden" name="intent" value="configure-homepage" />
              <input type="hidden" name="entityType" value="collection" />
              <input type="hidden" name="entityId" value={collection.id} />
              <label>
                <input
                  type="checkbox"
                  name="showOnHomepage"
                  defaultChecked={collection.showOnHomepage}
                />
                Show on homepage
              </label>
              <label>
                Homepage position
                <input
                  type="number"
                  min={1}
                  name="homepagePosition"
                  defaultValue={collection.homepagePosition ?? 1}
                />
              </label>
              <button type="submit">Save shelf configuration</button>
            </Form>
            <Form method="post" className="curator-form">
              <input type="hidden" name="intent" value="add-item" />
              <input type="hidden" name="entityType" value="collection" />
              <input type="hidden" name="entityId" value={collection.id} />
              <label>
                Add track
                <select name="trackId" required defaultValue="">
                  <option value="" disabled>
                    Select track
                  </option>
                  {data.tracks.map((track) => (
                    <option value={track.id} key={track.id}>
                      {track.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Add track</button>
            </Form>
            <ol>
              {data.collectionItems[collection.id]?.map((item, index, items) => (
                <li key={item.id}>
                  {data.tracks.find((track) => track.id === item.trackId)?.title ??
                    data.releases.find((release) => release.id === item.releaseId)?.title ??
                    "Unavailable item"}
                  <div className="curator-actions">
                    {index > 0 ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="move-item" />
                        <input type="hidden" name="entityType" value="collection" />
                        <input type="hidden" name="entityId" value={collection.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button type="submit">Move up</button>
                      </Form>
                    ) : null}
                    {index < items.length - 1 ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="move-item" />
                        <input type="hidden" name="entityType" value="collection" />
                        <input type="hidden" name="entityId" value={collection.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button type="submit">Move down</button>
                      </Form>
                    ) : null}
                    <Form method="post">
                      <input type="hidden" name="intent" value="remove-item" />
                      <input type="hidden" name="entityType" value="collection" />
                      <input type="hidden" name="entityId" value={collection.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <button type="submit">Remove</button>
                    </Form>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>

      <section className="curator-section">
        <h2>Managed media</h2>
        <MediaUpload tracks={data.tracks} />
      </section>

      <section className="curator-section">
        <h2>Publication operations</h2>
        <Form method="post">
          <input type="hidden" name="intent" value="publish-scheduled" />
          <button type="submit">Publish due scheduled records</button>
        </Form>
        <h3>Audit history</h3>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Entity</th>
              <th>Transition</th>
              <th>Actor</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {data.audit.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.occurredAt).toLocaleString()}</td>
                <td>{entry.entityType}</td>
                <td>
                  {entry.fromLifecycle} → {entry.toLifecycle}
                </td>
                <td>{entry.actorEmail}</td>
                <td>{entry.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
