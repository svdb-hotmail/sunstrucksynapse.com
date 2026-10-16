import {
  data,
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import { SITE_NAME } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { parseCatalogueQuery } from "~/services/curator-catalogue";
import { CatalogueWorkspace } from "~/features/curator-workspace/CatalogueWorkspace";

export { action } from "./curator-tools";
export const meta = () => [{ title: `Catalogue | ${SITE_NAME}` }];
export const headers = () => ({ "cache-control": "private, no-store" });

export async function loader({ request, context }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) throw auth.response;
  let query;
  try {
    query = parseCatalogueQuery(new URL(request.url).searchParams);
  } catch {
    throw new Response("Invalid catalogue filters or page.", { status: 400 });
  }
  if (!runtime.curatorCatalogueRepository)
    throw new Response("Catalogue temporarily unavailable.", { status: 503 });
  try {
    const page = await runtime.curatorCatalogueRepository.read(query);
    if (query.trackId && !page.selected) throw new Response("Track not found.", { status: 404 });
    return data({ page, query, identity: auth.identity }, { headers: headers() });
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response("Catalogue temporarily unavailable.", { status: 503 });
  }
}

export default function CuratorCatalogueRoute() {
  const { page, query, identity } = useLoaderData<typeof loader>();
  return (
    <CatalogueWorkspace
      key={JSON.stringify([query.query, page.view, query.after])}
      page={page}
      query={query}
      identity={{
        name: identity.email,
        email: identity.email,
        initials: identity.email.slice(0, 2).toUpperCase(),
      }}
    />
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 503;
  return (
    <main className="catalogue-error">
      <p className="curator-overline">Private catalogue</p>
      <h1>
        {status === 401 || status === 403
          ? "Curator access required"
          : status === 400
            ? "Invalid catalogue filters"
            : status === 404
              ? "Track not found"
              : "Unable to verify the catalogue"}
      </h1>
      <p>
        {status >= 500
          ? "The catalogue service could not be reached. Refresh to check its current state."
          : "Open the catalogue again with an authorised curator account and valid filters."}
      </p>
      <Link to="/curator" reloadDocument className="curator-button">
        Reload catalogue
      </Link>
    </main>
  );
}
