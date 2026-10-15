import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useFetcher, useNavigate, useSearchParams } from "react-router";
import type { loader } from "~/routes/curator-submissions";
import { useLoaderData } from "react-router";
import { CuratorShell } from "./CuratorShell";
import { SubmissionQueue, type QueueFilter } from "./SubmissionQueue";
import { ReviewWorkspace, type ReviewScores, type ReviewGrade } from "./ReviewWorkspace";
import type { CuratorQueueItemView, CuratorReviewView } from "./types";

const emptyScores: ReviewScores = {
  artisticQuality: null,
  originalityIntent: null,
  productionReadiness: null,
  editorialFit: null,
};
type Draft = { scores: ReviewScores; grade: ReviewGrade | null; rationale: string };

function ReviewDraft({
  review,
  actor,
  busy,
  notice,
  submit,
  close,
}: {
  review: CuratorReviewView;
  actor: string;
  busy: boolean;
  notice?: string;
  submit: (values: Record<string, string>) => void;
  close: () => void;
}) {
  const key = `sunsyn:review-draft:${actor}:${review.submission.id}`;
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState<Draft>({ scores: emptyScores, grade: null, rationale: "" });
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) setDraft(JSON.parse(stored) as Draft);
    } catch {
      /* Storage may be unavailable. */
    }
    setRestored(true);
  }, [key]);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      if (restored) sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      setStorageError(true);
    }
  }, [draft, key, restored]);
  return (
    <ReviewWorkspace
      review={review}
      scores={draft.scores}
      grade={draft.grade}
      rationale={draft.rationale}
      pending={busy}
      notice={
        notice ??
        (storageError
          ? "Browser storage unavailable; keep this review open to retain input."
          : undefined)
      }
      onScore={(criterion, score) =>
        setDraft((d) => ({ ...d, scores: { ...d.scores, [criterion]: score } }))
      }
      onGrade={(grade) => setDraft((d) => ({ ...d, grade }))}
      onRationale={(rationale) => setDraft((d) => ({ ...d, rationale }))}
      onLater={close}
      onAskArtist={(claimKey, message) => submit({ intent: "clarify", claimKey, message })}
      onFinish={() =>
        submit({
          intent: "grade",
          finalGrade: draft.grade ?? "",
          rationale: draft.rationale,
          ...Object.fromEntries(
            Object.entries(draft.scores).map(([name, score]) => [name, String(score ?? "")]),
          ),
        })
      }
      onFinishAndPublish={() =>
        submit({
          intent: "grade",
          afterDecision: "publish",
          finalGrade: draft.grade ?? "",
          rationale: draft.rationale,
          ...Object.fromEntries(
            Object.entries(draft.scores).map(([name, score]) => [name, String(score ?? "")]),
          ),
        })
      }
    />
  );
}

export function ProductionQueue({
  data,
  invitation,
}: {
  data: ReturnType<typeof useLoaderData<typeof loader>>;
  invitation: ReactNode;
}) {
  const fetcher = useFetcher<{
    error?: string;
    claimedId?: string | null;
    finalizedId?: string;
    acceptedTrackId?: string | null;
    publishingTrackId?: string;
    nextWarning?: string;
    notificationWarning?: string;
  }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(data.filter.query);
  const filter = data.filter.queue;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const evidence = useFetcher<{ error?: string; grantUrl?: string; expiresAt?: string }>();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const handled = useRef<unknown>(null);
  const busy = fetcher.state !== "idle";
  const reviewId = params.get("review");
  const items: CuratorQueueItemView[] = data.submissions.map((row) => {
    const submission = row.submission;
    const copy = data.reviewAudio[submission.id];
    const attested = row.rights.status === "attested";
    const completed = ["accepted", "rejected", "withdrawn"].includes(submission.status);
    return {
      id: submission.id,
      publicReference: submission.publicReference,
      title: submission.title,
      artistName: submission.artistDetails.displayName,
      submitterEmail: submission.submitterEmail,
      status: submission.status as CuratorQueueItemView["status"],
      submittedAt: String(submission.submittedAt ?? ""),
      durationMs: copy?.durationMs ?? null,
      audioUrl: copy ? `/curator/review-audio/${copy.id}` : null,
      readiness: completed
        ? "completed"
        : submission.status === "clarification_requested"
          ? "flagged"
          : !copy
            ? "needs_audio"
            : row.claimable
              ? "ready"
              : "needs_information",
      rights: attested ? "attested" : "needs_review",
      assignedCuratorName: submission.assignedCuratorEmail,
    };
  });
  const matches = (item: CuratorQueueItemView, view: QueueFilter) =>
    view === "all" ||
    (view === "mine"
      ? item.assignedCuratorName === data.identity.email
      : view === "completed"
        ? ["accepted", "rejected", "withdrawn"].includes(item.status)
        : item.readiness === view);
  const counts =
    data.filterCounts ??
    (Object.fromEntries(
      (["all", "ready", "mine", "needs_audio", "flagged", "completed"] as const).map((view) => [
        view,
        items.filter((item) => matches(item, view)).length,
      ]),
    ) as Record<QueueFilter, number>);
  useEffect(() => {
    if (busy || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.finalizedId) {
      try {
        sessionStorage.removeItem(
          `sunsyn:review-draft:${data.identity.id}:${fetcher.data.finalizedId}`,
        );
      } catch {
        /* Optional storage. */
      }
    }
    if (fetcher.data.publishingTrackId) {
      navigate(`/curator/albums?track=${fetcher.data.publishingTrackId}`);
      return;
    }
    if ("claimedId" in fetcher.data)
      navigate(
        fetcher.data.claimedId
          ? `?review=${fetcher.data.claimedId}`
          : fetcher.data.nextWarning
            ? "?flash=next-claim-failed"
            : "?flash=no-ready-submissions",
      );
  }, [busy, fetcher.data, navigate, data.identity.id]);
  useEffect(() => {
    setQuery(data.filter.query);
  }, [data.filter.query]);
  useEffect(() => {
    if (query === data.filter.query) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      next.set("q", query.slice(0, 200));
      next.delete("page");
      navigate(`?${next}`, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, data.filter.query, navigate, params]);
  const queueUrl = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) next.set(key, value);
    return `?${next}`;
  };
  const aggregate = data.submissions.find((row) => row.submission.id === reviewId);
  const item = items.find((row) => row.id === reviewId);
  const review: CuratorReviewView | null =
    aggregate && item
      ? {
          submission: item,
          artistBiography: aggregate.submission.artistDetails.shortBiography,
          artistLocation: aggregate.submission.artistDetails.location,
          creativeContribution: aggregate.process.meaningfulHumanContribution,
          aiTools: aggregate.process.aiTools.map((tool) => tool.name),
          territories: aggregate.rights.territories,
          rightsSummary: aggregate.rights.publicSummary,
          rightsDetails: [
            ...new Set(
              [
                aggregate.rights.entitlementStatement,
                aggregate.rights.authorityDetails,
                aggregate.rights.thirdPartyMaterialDetails,
                aggregate.rights.restrictions,
                aggregate.rights.privateNotes,
              ].filter(Boolean),
            ),
          ].join("\n\n"),
          provenanceSummary: aggregate.provenance.summary,
          evidenceCount: aggregate.evidence.length,
          activities: aggregate.activities.map((activity) => ({
            id: activity.id,
            label: `${activity.activityType}: ${activity.message ?? ""}`,
            timestamp: String(activity.createdAt),
          })),
          files: aggregate.evidence.map((file) => ({
            id: file.id,
            filename: file.originalFilename,
            detail: file.malwareStatus,
          })),
        }
      : null;
  const submit = (values: Record<string, string>) => {
    if (!busy)
      void fetcher.submit(
        { ...values, workspace: "1", submissionId: reviewId ?? "" },
        { method: "post" },
      );
  };
  const play = async (row: CuratorQueueItemView) => {
    const element = audio.current;
    if (!element || !row.audioUrl) return;
    if (playingId === row.id) {
      element.pause();
      setPlayingId(null);
      return;
    }
    element.pause();
    element.src = row.audioUrl;
    setSelectedId(row.id);
    setAudioError(null);
    try {
      await element.play();
      setPlayingId(row.id);
    } catch {
      setPlayingId(null);
      setAudioError("Private audition could not play. Try again after checking your connection.");
    }
  };
  return (
    <CuratorShell
      activeSection="queue"
      identity={{
        name: data.identity.email,
        email: data.identity.email,
        initials: data.identity.email.slice(0, 2).toUpperCase(),
      }}
      navigation={[
        { id: "queue", label: "Submissions", href: "/curator/submissions" },
        { id: "collections", label: "Publishing queue", href: "/curator/albums" },
        { id: "analytics", label: "Analytics", href: "/curator/analytics" },
      ]}
      searchValue={query}
      onSearch={setQuery}
    >
      <h1>Curator workspace</h1>
      {fetcher.data?.acceptedTrackId ? (
        <p className="publishing-message" role="status">
          Accepted and queued for publishing.{" "}
          <Link to={`/curator/albums?track=${fetcher.data.acceptedTrackId}`}>
            Prepare release now →
          </Link>
        </p>
      ) : null}
      {(aggregate ?? data.submissions.find((row) => row.submission.id === selectedId))?.evidence
        .length ? (
        <details className="curator-panel">
          <summary>Protected evidence</summary>
          {(
            aggregate ?? data.submissions.find((row) => row.submission.id === selectedId)
          )?.evidence.map((file) => (
            <div key={file.id}>
              <p>
                {file.originalFilename} · {file.malwareStatus}
              </p>
              <evidence.Form method="post">
                <input type="hidden" name="intent" value="grant-evidence" />
                <input
                  type="hidden"
                  name="submissionId"
                  value={aggregate?.submission.id ?? selectedId ?? ""}
                />
                <input type="hidden" name="evidenceId" value={file.id} />
                <button disabled={evidence.state !== "idle"}>Open secure evidence link</button>
              </evidence.Form>
              <evidence.Form method="post">
                <input type="hidden" name="intent" value="malware" />
                <input
                  type="hidden"
                  name="submissionId"
                  value={aggregate?.submission.id ?? selectedId ?? ""}
                />
                <input type="hidden" name="evidenceId" value={file.id} />
                <label>
                  Evidence status
                  <select name="malwareStatus" defaultValue={file.malwareStatus}>
                    <option value="pending_review">Pending review</option>
                    <option value="cleared">Cleared</option>
                    <option value="quarantined">Quarantined</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <label>
                  Evidence note
                  <input name="message" />
                </label>
                <button disabled={evidence.state !== "idle"}>Save evidence status</button>
              </evidence.Form>
            </div>
          ))}
        </details>
      ) : null}
      {data.outbox?.failed ? (
        <p role="alert">
          {data.outbox.failed} background notification(s) failed. Decisions remain saved; contact
          the operator to retry delivery.
        </p>
      ) : null}
      {data.outbox && data.outbox.pending + data.outbox.processing > 0 ? (
        <p role="status">
          {data.outbox.pending + data.outbox.processing} notifications awaiting delivery.
        </p>
      ) : null}
      {data.flash === "next-claim-failed" ? (
        <p role="status">
          Saved successfully. The next item could not be claimed; retry Review next.
        </p>
      ) : null}
      {fetcher.data?.notificationWarning ? (
        <p role="status">{fetcher.data.notificationWarning}</p>
      ) : null}
      {fetcher.data?.error ? <p role="alert">{fetcher.data.error}</p> : null}
      {data.flash === "no-ready-submissions" ? (
        <p role="status">No ready submissions. Check waiting items or create an invitation.</p>
      ) : null}
      {evidence.data?.error ? <p role="alert">{evidence.data.error}</p> : null}
      {evidence.data?.grantUrl ? (
        <p role="status">
          <a href={evidence.data.grantUrl}>Open protected evidence</a> · expires{" "}
          {evidence.data.expiresAt}
        </p>
      ) : null}
      {review &&
      aggregate?.submission.status === "listening" &&
      aggregate.submission.assignedCuratorId === data.identity.id ? (
        <ReviewDraft
          key={review.submission.id}
          review={review}
          actor={data.identity.id}
          busy={busy}
          notice={fetcher.data?.error}
          submit={submit}
          close={() => navigate("/curator/submissions")}
        />
      ) : (
        <>
          {invitation}
          <button
            disabled={busy || !data.workflowAvailable}
            onClick={() => submit({ intent: "claim-next" })}
          >
            Review next ready submission
          </button>
          {audioError ? <p role="alert">{audioError}</p> : null}
          <audio
            ref={audio}
            onEnded={() => setPlayingId(null)}
            onError={() => {
              setPlayingId(null);
              setAudioError("Private audio unavailable. Reload or retry.");
            }}
          />
          <SubmissionQueue
            activeFilter={filter}
            filterCounts={counts}
            items={items.filter((row) => row.id !== reviewId || matches(row, filter))}
            playingId={playingId}
            selectedId={selectedId}
            onFilterChange={(queue) => navigate(queueUrl({ queue, page: "1" }))}
            onSelect={(row) => setSelectedId(row.id)}
            onTogglePlayback={(row) => void play(row)}
          />
          {selectedId ? (
            <section aria-label="Selected submission" className="curator-panel">
              <h2>{items.find((row) => row.id === selectedId)?.title}</h2>
              {data.submissions.find((row) => row.submission.id === selectedId)?.submission
                .resultingTrackId ? (
                <Link
                  to={`/curator/albums?track=${data.submissions.find((row) => row.submission.id === selectedId)!.submission.resultingTrackId}`}
                >
                  Continue to publishing →
                </Link>
              ) : null}
              <p>
                {
                  data.submissions.find((row) => row.submission.id === selectedId)?.rights
                    .publicSummary
                }
              </p>
              <p>
                {
                  data.submissions.find((row) => row.submission.id === selectedId)?.process
                    .meaningfulHumanContribution
                }
              </p>
            </section>
          ) : null}
          {selectedId ? (
            <button
              disabled={
                busy ||
                !(
                  items.find((row) => row.id === selectedId)?.readiness === "ready" ||
                  data.submissions.some(
                    (row) =>
                      row.submission.id === selectedId &&
                      row.submission.status === "listening" &&
                      row.submission.assignedCuratorId === data.identity.id,
                  )
                )
              }
              onClick={() => {
                audio.current?.pause();
                setPlayingId(null);
                submit({ intent: "claim-next", requestedId: selectedId });
              }}
            >
              Review selected submission
            </button>
          ) : null}
          <nav aria-label="Queue pages">
            {data.page > 1 ? (
              <Link to={queueUrl({ page: String(data.page - 1) })}>Previous</Link>
            ) : null}{" "}
            Page {data.page}
            {data.hasNextPage ? (
              <Link to={queueUrl({ page: String(data.page + 1) })}>Next</Link>
            ) : null}
          </nav>
        </>
      )}
    </CuratorShell>
  );
}
