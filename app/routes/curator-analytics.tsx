import { Form, Link } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import type { AnalyticsGroup } from "~/repositories/analytics.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";

import type { Route } from "./+types/curator-analytics";

const groups: AnalyticsGroup[] = ["track", "artist", "release", "collection"];

function dateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? fallback : date;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) throw auth.response;
  if (!runtime.analyticsRepository) {
    throw new Response("Analytics service unavailable.", { status: 503 });
  }
  const url = new URL(request.url);
  const now = new Date();
  const defaultFrom = new Date(now.valueOf() - 30 * 86_400_000);
  const requestedGroup = url.searchParams.get("group") as AnalyticsGroup | null;
  const group = requestedGroup && groups.includes(requestedGroup) ? requestedGroup : "track";
  const from = dateParam(url.searchParams.get("from"), defaultFrom);
  const to = dateParam(url.searchParams.get("to"), now);
  to.setUTCHours(23, 59, 59, 999);
  if (from > to) {
    throw new Response("The start date must not be after the end date.", { status: 400 });
  }
  return {
    group,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    rows: await runtime.analyticsRepository.summarize(group, from, to),
  };
}

export default function CuratorAnalyticsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <main className="curator-shell">
      <header className="curator-header">
        <div>
          <p className="eyebrow">Curator workspace</p>
          <h1>Catalogue analytics</h1>
          <p>Anonymous, first-party listening signals. Obvious automated traffic is excluded.</p>
        </div>
        <Link to="/curator">Back to catalogue management</Link>
      </header>

      <Form method="get" className="curator-filter-bar">
        <label>
          Group by
          <select name="group" defaultValue={loaderData.group}>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" name="from" defaultValue={loaderData.from} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={loaderData.to} />
        </label>
        <button type="submit">Apply</button>
      </Form>

      {loaderData.rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{loaderData.group}</th>
                <th scope="col">Starts</th>
                <th scope="col">30-second listens</th>
                <th scope="col">Completions</th>
                <th scope="col">Skips</th>
                <th scope="col">Replays</th>
              </tr>
            </thead>
            <tbody>
              {loaderData.rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.name}</th>
                  <td>{row.starts}</td>
                  <td>{row.listens30}</td>
                  <td>{row.completions}</td>
                  <td>{row.skips}</td>
                  <td>{row.replays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">No listening events were recorded in this period.</p>
      )}
    </main>
  );
}
