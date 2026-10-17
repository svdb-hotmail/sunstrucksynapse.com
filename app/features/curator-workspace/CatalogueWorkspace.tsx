import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigate, useRevalidator, useSearchParams } from "react-router";
import {
  catalogueLabels,
  catalogueViews,
  type CatalogueQuery,
  type CatalogueView,
  type CuratorCataloguePage,
  type CuratorCatalogueTrack,
} from "~/types/curator-catalogue";
import {
  catalogueActionLabel,
  catalogueExplanation,
  catalogueVisibility,
} from "~/services/curator-catalogue";
import { CuratorShell } from "./CuratorShell";
import { CuratorBadge } from "./CuratorPrimitives";
import type { CuratorIdentityView } from "./types";
import { hasActivePreparation, startCatalogueRefresh } from "~/services/catalogue-refresh";

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  }).format(new Date(value));

export function CatalogueWorkspace({
  page,
  query,
  identity,
}: {
  page: CuratorCataloguePage;
  query: CatalogueQuery;
  identity: CuratorIdentityView;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const batch = useRef<HTMLDialogElement>(null);
  const track = page.selected;
  const preparing = hasActivePreparation([...page.items, ...(track ? [track] : [])]);
  useEffect(() => {
    if (!preparing) return;
    return startCatalogueRefresh(
      revalidator.revalidate,
      () => document.visibilityState === "visible",
    );
  }, [preparing, revalidator.revalidate]);
  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.set("view", page.view);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    return `/curator?${next}`;
  };
  const close = () => void navigate(href({ track: null }), { preventScrollReset: true });
  useEffect(() => {
    if (track && !drawer.current?.open) drawer.current?.showModal();
    if (!track && drawer.current?.open) drawer.current.close();
  }, [track]);
  useEffect(() => {
    if (reviewing) batch.current?.showModal();
    else batch.current?.close();
  }, [reviewing]);
  const eligible = page.items.filter((t) => t.state === "ready" && selected.includes(t.id));
  const releases = [...new Map(eligible.map((t) => [t.releaseId, t])).values()];
  const focus = (t: CuratorCatalogueTrack) => href({ track: t.id });
  const statusTone = (state: CatalogueView) =>
    state === "live" || state === "ready"
      ? "success"
      : state === "attention"
        ? "warning"
        : "neutral";
  return (
    <CuratorShell
      activeSection="catalogue"
      identity={identity}
      navigation={[
        { id: "queue", label: "Review submissions", href: "/curator/submissions" },
        { id: "catalogue", label: "Catalogue", href: "/curator" },
        { id: "collections", label: "Release preparation", href: "/curator/albums" },
        { id: "analytics", label: "Insights", href: "/curator/analytics" },
        { id: "settings", label: "Catalogue tools", href: "/curator/tools", separatorBefore: true },
      ]}
    >
      <header className="curator-page-heading">
        <div>
          <p className="curator-overline">Your music, in one place</p>
          <h1>Catalogue</h1>
          <p>See what listeners can hear. Give your attention to what needs it.</p>
        </div>
        <div className="catalogue-heading-actions">
          <button
            type="button"
            className="curator-button"
            disabled={revalidator.state !== "idle"}
            onClick={() => void revalidator.revalidate()}
          >
            Refresh catalogue
          </button>
          <Link to="/" className="curator-button">
            Public catalogue →
          </Link>
        </div>
      </header>
      <div className="catalogue-overview">
        {(["attention", "ready", "live"] as const).map((view) => (
          <Link
            key={view}
            to={href({ view, after: null, track: null })}
            className={`catalogue-stat catalogue-stat--${view}`}
          >
            <span>
              {view === "attention"
                ? "Needs your attention"
                : view === "ready"
                  ? "Ready to go"
                  : "Live on SunSyn"}
            </span>
            <strong>{page.counts[view]}</strong>
            <small>
              {view === "attention"
                ? "One clear next step"
                : view === "ready"
                  ? "Awaiting your decision"
                  : "Listed with listening media"}
            </small>
          </Link>
        ))}
      </div>
      <Form method="get" className="catalogue-search" role="search" key={query.query}>
        <input type="hidden" name="view" value={page.view} />
        <label className="visually-hidden" htmlFor="catalogue-query">
          Search catalogue
        </label>
        <input
          id="catalogue-query"
          type="search"
          name="q"
          defaultValue={query.query}
          maxLength={200}
          placeholder="Find a track, artist or release…"
        />
        <button type="submit" className="curator-button">
          Search
        </button>
      </Form>
      <nav className="catalogue-views" aria-label="Catalogue views">
        {catalogueViews.map((view) => (
          <Link
            to={href({ view, after: null, track: null })}
            key={view}
            aria-current={page.view === view ? "page" : undefined}
          >
            {catalogueLabels[view]} <span>{page.counts[view]}</span>
          </Link>
        ))}
      </nav>
      {releases.length > 0 && (
        <div className="catalogue-selection" role="status">
          <span>
            {eligible.length} ready tracks in {releases.length} complete releases selected
          </span>
          <button
            type="button"
            className="curator-button curator-button--primary"
            onClick={() => setReviewing(true)}
          >
            Review releases
          </button>
        </div>
      )}
      <div className="catalogue-library">
        <table>
          <caption className="visually-hidden">
            Catalogue tracks, listener visibility and next steps
          </caption>
          <thead>
            <tr>
              <th scope="col">Select</th>
              <th scope="col">Track / artist</th>
              <th scope="col" className="catalogue-listeners">
                Listeners
              </th>
              <th scope="col" className="catalogue-status">
                Status
              </th>
              <th scope="col">Next step</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((t) => (
              <tr key={t.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${t.title} for release review`}
                    disabled={t.state !== "ready"}
                    checked={eligible.some((item) => item.id === t.id)}
                    onChange={(e) =>
                      setSelected((value) =>
                        e.target.checked ? [...value, t.id] : value.filter((id) => id !== t.id),
                      )
                    }
                  />
                </td>
                <td>
                  <div className="catalogue-track">
                    <span className="catalogue-cover" aria-hidden="true">
                      {t.title.slice(0, 1)}
                    </span>
                    <div>
                      <Link to={focus(t)} preventScrollReset>
                        {t.title}
                      </Link>
                      <small>
                        {t.artistName} · {t.releaseTitle}
                      </small>
                      <span className="catalogue-mobile-state">
                        {catalogueVisibility(t)} · {catalogueLabels[t.state]}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="catalogue-listeners">{catalogueVisibility(t)}</td>
                <td className="catalogue-status">
                  <CuratorBadge tone={statusTone(t.state)}>{catalogueLabels[t.state]}</CuratorBadge>
                </td>
                <td>
                  <Link
                    className="curator-button curator-button--ghost"
                    to={focus(t)}
                    preventScrollReset
                  >
                    {catalogueActionLabel(t)} →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!page.items.length && (
          <div className="catalogue-empty">
            <h2>{page.counts.all ? "No tracks in this view" : "No matching tracks"}</h2>
            <p>Try another search or view.</p>
            <Link to="/curator?view=all">Show all tracks</Link>
          </div>
        )}
        <footer className="catalogue-pagination">
          <span>
            {page.items.length} shown · {page.counts[page.view]} matching tracks · sorted by title
          </span>
          <div>
            {query.after && <Link to={href({ after: null, track: null })}>First page</Link>}
            {page.next && (
              <Link to={href({ after: JSON.stringify(page.next), track: null })}>Next page →</Link>
            )}
          </div>
        </footer>
      </div>
      <p className="catalogue-note">
        One decision, one complete release. Publication coordinates tracks, artwork and artist
        records.
      </p>
      <p className="catalogue-freshness">
        Checked {dateTime(page.observedAt)} Europe/Brussels · refresh when you need a new snapshot.
      </p>
      <dialog
        ref={drawer}
        className="catalogue-drawer"
        aria-labelledby="catalogue-detail-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        {track && (
          <>
            <header className="catalogue-drawer-heading">
              <p className="curator-overline">Track details</p>
              <button
                type="button"
                className="curator-button"
                onClick={close}
                aria-label="Close track details"
              >
                ×
              </button>
            </header>
            <h2 id="catalogue-detail-title">{track.title}</h2>
            <p>
              {track.artistName} · {track.releaseTitle}
            </p>
            <CuratorBadge tone={statusTone(track.state)}>
              {catalogueLabels[track.state]}
            </CuratorBadge>
            <section className="catalogue-notice">
              <h3>{catalogueVisibility(track)}</h3>
              <p>{catalogueExplanation(track)}</p>
            </section>
            <div className="catalogue-detail-actions">
              {track.state === "live" && (
                <Link
                  className="curator-button curator-button--primary"
                  to={`/tracks/${track.releaseSlug}/${track.slug}`}
                >
                  Open public track →
                </Link>
              )}
              {track.state !== "archived" && (
                <Link
                  className="curator-button curator-button--primary"
                  to={`/curator/albums?album=${track.releaseId}`}
                >
                  {track.state === "ready" ? "Review release publication" : "Open complete release"}
                </Link>
              )}
              {track.submissionId && (
                <Link
                  className="curator-button"
                  to={`/curator/submissions/${track.submissionId}/edit`}
                >
                  Edit details
                </Link>
              )}
            </div>
            <p className="catalogue-scope">
              Release scope: {track.releaseTrackCount} track
              {track.releaseTrackCount === 1 ? "" : "s"}. Publication affects the complete release.
            </p>
            {track.scheduledFor && <p>Scheduled: {dateTime(track.scheduledFor)} Europe/Brussels</p>}
            {track.submissionId && track.coverReady && (
              <img
                className="catalogue-detail-cover"
                loading="lazy"
                src={`/curator/submissions/${track.submissionId}/artwork`}
                alt={`Cover for ${track.releaseTitle}`}
              />
            )}
            {track.previewUrl && (
              <audio
                key={track.id}
                controls
                preload="none"
                src={track.previewUrl}
                aria-label={`Private streaming preview for ${track.title}`}
              />
            )}
            <h3>Readiness checks</h3>
            {track.blockers.length ? (
              <ul className="catalogue-blockers">
                {track.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p>Publication readiness checks pass.</p>
            )}
            {track.failureCode && <p>Preparation result: {track.failureCode}</p>}
            <details>
              <summary>History & technical details</summary>
              <dl>
                <dt>Track</dt>
                <dd>{track.lifecycleStatus}</dd>
                <dt>Release</dt>
                <dd>{track.releaseStatus}</dd>
                <dt>Credited artists</dt>
                <dd>{track.artistStatuses.join(", ") || "Missing"}</dd>
                <dt>Preparation</dt>
                <dd>{track.preparationStatus ?? "No automatic job"}</dd>
              </dl>
              <p>Publication status is separate from listener visibility.</p>
              <ol className="catalogue-history">
                {page.history.map((entry) => (
                  <li key={entry.id}>
                    <time>{dateTime(entry.occurredAt)}</time>
                    <strong>
                      {entry.entityType}: {entry.fromLifecycle} → {entry.toLifecycle}
                    </strong>
                    <p>{entry.reason}</p>
                  </li>
                ))}
              </ol>
              {!page.history.length && <p>No recorded publication events.</p>}
              <Link to="/curator/tools">Open catalogue tools</Link>
            </details>
          </>
        )}
      </dialog>
      <dialog
        ref={batch}
        className="catalogue-review"
        aria-labelledby="catalogue-review-title"
        onCancel={() => setReviewing(false)}
      >
        <h2 id="catalogue-review-title">Review complete releases</h2>
        <p>
          Each release needs its own current readiness check and deliberate publication
          confirmation. Selecting one track includes its full release.
        </p>
        <ul>
          {releases.map((t) => (
            <li key={t.releaseId}>
              <strong>{t.releaseTitle}</strong> · {t.releaseTrackCount} tracks{" "}
              <Link to={`/curator/albums?album=${t.releaseId}`}>Review release →</Link>
            </li>
          ))}
        </ul>
        <button type="button" className="curator-button" onClick={() => setReviewing(false)}>
          Keep browsing
        </button>
      </dialog>
    </CuratorShell>
  );
}
