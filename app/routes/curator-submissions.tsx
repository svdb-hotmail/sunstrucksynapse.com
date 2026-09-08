import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { SITE_NAME } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { CurationScorecard } from "~/components/CurationScorecard";
import { createCurationWorkflowRepository } from "~/repositories/curation-workflow.server";
import { createCurationOutboxRepository } from "~/repositories/curation-outbox.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { SubmissionEvidenceService } from "~/services/submission-evidence.server";
import { SubmissionService, submissionHttpStatus } from "~/services/submissions.server";
import { createTransactionalEmailService } from "~/services/transactional-email.server";
import { validateUuid } from "~/services/curator-validation";
import type { SubmissionStatus } from "~/types/submissions";
import { curationRationaleError } from "~/types/curation";

import type { Route } from "./+types/curator-submissions";

const CURATION_QUEUE_PAGE_SIZE = 25;

export async function loader({ request, context }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) throw auth.response;
  if (!runtime.submissionRepository || !runtime.curatorRepository) {
    throw new Response("Submission service unavailable.", { status: 503 });
  }
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filter = {
    status: (url.searchParams.get("status") ?? "all") as SubmissionStatus | "all",
    assignedTo: url.searchParams.get("assignedTo") ?? "all",
    limit: CURATION_QUEUE_PAGE_SIZE + 1,
    offset: (page - 1) * CURATION_QUEUE_PAGE_SIZE,
  };
  const workflow =
    runtime.curationWorkflowRepository ??
    (runtime.db ? createCurationWorkflowRepository(runtime.db) : null);
  const outboxPromise = runtime.db
    ? createCurationOutboxRepository(runtime.db).statusCounts()
    : Promise.resolve(null);
  const pageRows = await runtime.submissionRepository.listCuratorSubmissions(filter);
  const hasNextPage = pageRows.length > CURATION_QUEUE_PAGE_SIZE;
  const submissions = pageRows.slice(0, CURATION_QUEUE_PAGE_SIZE);
  const reviewAudio = workflow
    ? await workflow.currentAudioForSubmissions(submissions.map(({ submission }) => submission.id))
    : {};
  const outbox = await outboxPromise;
  return {
    identity: auth.identity,
    submissions,
    flash: url.searchParams.get("flash"),
    reviewAudio,
    outbox,
    workflowAvailable: Boolean(workflow),
    filter: { status: filter.status, assignedTo: filter.assignedTo },
    page,
    hasNextPage,
  };
}

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) return auth.response;
  if (!runtime.submissionRepository || !runtime.curatorRepository) {
    return bad("Submission service unavailable.", 503);
  }
  const service = new SubmissionService(
    runtime.submissionRepository,
    createTransactionalEmailService(runtime.env),
  );
  const workflow =
    runtime.curationWorkflowRepository ??
    (runtime.db ? createCurationWorkflowRepository(runtime.db) : null);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "claim-next") {
    if (!workflow) return bad("Curation workflow unavailable.", 503);
    const submissionId = await workflow.claimNextSubmission(auth.identity, new Date());
    return submissionId
      ? redirect(`/curator/submissions?flash=ready#submission-${submissionId}`)
      : redirect("/curator/submissions?flash=no-ready-submissions");
  }
  const submissionIdResult = validateUuid(form.get("submissionId"), "submissionId");
  if (!submissionIdResult.ok) return bad(submissionIdResult.fieldErrors.submissionId);
  const submissionId = submissionIdResult.value;

  if (intent === "grade") {
    if (!workflow) return bad("Curation workflow unavailable.", 503);
    const score = (name: string) => Number(form.get(name));
    const artisticQuality = score("artisticQuality");
    const originalityIntent = score("originalityIntent");
    const productionReadiness = score("productionReadiness");
    const editorialFit = score("editorialFit");
    if (
      ![artisticQuality, originalityIntent, productionReadiness, editorialFit].every(
        (value) => Number.isInteger(value) && value >= 1 && value <= 5,
      )
    ) {
      return bad("Every assessment score must be between 1 and 5.");
    }
    const finalGrade = String(form.get("finalGrade") ?? "");
    if (finalGrade !== "A" && finalGrade !== "B" && finalGrade !== "C") {
      return bad("Choose final grade A, B, or C.");
    }
    const rationale = String(form.get("rationale") ?? "").trim();
    const rationaleError = curationRationaleError(rationale);
    if (rationaleError) return bad(rationaleError);
    const result = await workflow.finalizeReview(
      {
        submissionId,
        artisticQuality,
        originalityIntent,
        productionReadiness,
        editorialFit,
        finalGrade,
        rationale,
      },
      auth.identity,
      new Date(),
    );
    if (!result) return bad("Submission changed or is not ready for a final decision.", 409);
    return redirect(`/curator/submissions?flash=${result.status}`);
  }

  if (intent === "assign") {
    if (workflow) return bad("Use Review next for an exclusive queue claim.");
    await service.assignCurator(submissionId, auth.identity);
    return redirect("/curator/submissions?flash=assigned");
  }
  if (intent === "transition") {
    const toStatus = String(form.get("toStatus") ?? "");
    if (workflow && toStatus === "listening") {
      return bad("Use Review next for an exclusive queue claim.", 409);
    }
    const result = await service.transition({
      submissionId,
      actor: auth.identity,
      toStatus: toStatus as never,
      transitionedAt: new Date(),
      note: String(form.get("note") ?? "").trim() || null,
    });
    if (!result.ok) return bad(result.error.message, submissionHttpStatus(result.error.code));
    return redirect("/curator/submissions?flash=transitioned");
  }
  if (intent === "note") {
    await service.addNote({
      submissionId,
      actor: auth.identity,
      createdAt: new Date(),
      message: String(form.get("message") ?? "").trim(),
    });
    return redirect("/curator/submissions?flash=noted");
  }
  if (intent === "clarify") {
    const claimKey = String(form.get("claimKey") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    const result = await service.requestClarification({
      submissionId,
      actor: auth.identity,
      createdAt: new Date(),
      claimKey,
      message,
    });
    if (!result.ok) return bad(result.error.message, submissionHttpStatus(result.error.code));
    return redirect("/curator/submissions?flash=clarification");
  }
  if (intent === "accept" || intent === "reject") {
    return bad("Use the listening scorecard to finalize an editorial decision.");
  }
  if (intent === "malware") {
    const evidenceId = validateUuid(form.get("evidenceId"), "evidenceId");
    if (!evidenceId.ok) return bad(evidenceId.fieldErrors.evidenceId);
    const malwareStatus = String(form.get("malwareStatus") ?? "");
    const updated = await runtime.submissionRepository.updateEvidenceMalwareStatus(
      evidenceId.value,
      auth.identity,
      new Date(),
      malwareStatus as never,
      String(form.get("message") ?? "").trim() || null,
    );
    if (!updated) return bad("Evidence not found.", 404);
    return redirect("/curator/submissions?flash=evidence");
  }
  if (intent === "grant-evidence") {
    if (!runtime.db || !runtime.env) {
      return bad("Evidence access is unavailable.", 503);
    }
    const evidenceService = new SubmissionEvidenceService(
      runtime.db,
      runtime.submissionRepository,
      runtime.env,
    );
    const evidenceId = validateUuid(form.get("evidenceId"), "evidenceId");
    if (!evidenceId.ok) return bad(evidenceId.fieldErrors.evidenceId);
    const grant = await evidenceService.createCuratorAccessGrant(evidenceId.value, auth.identity);
    if (!grant.ok) return bad(grant.message, grant.status);
    return Response.json({
      grantUrl: `/submission-evidence/${grant.value.token}`,
      expiresAt: grant.value.expiresAt,
    });
  }
  return bad("Unsupported submission action.");
}

export const meta: Route.MetaFunction = () => [{ title: `Curator submissions | ${SITE_NAME}` }];

export default function CuratorSubmissionsRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string; grantUrl?: string; expiresAt?: string }>();
  const pageHref = (page: number) => {
    const parameters = new URLSearchParams();
    if (data.filter.status !== "all") parameters.set("status", data.filter.status);
    if (data.filter.assignedTo !== "all") parameters.set("assignedTo", data.filter.assignedTo);
    parameters.set("page", String(page));
    return `?${parameters.toString()}`;
  };
  return (
    <main className="curator-workspace">
      <p className="eyebrow">Curator workspace</p>
      <h1>Submission review</h1>
      <p>Signed in as {data.identity.email}</p>
      {data.outbox ? (
        <p className="curation-operations" role={data.outbox.failed ? "alert" : undefined}>
          Notifications: {data.outbox.pending} pending · {data.outbox.processing} sending ·{" "}
          {data.outbox.failed} failed
        </p>
      ) : null}
      {data.flash ? <p role="status">{data.flash}</p> : null}
      {actionData?.error ? <p role="alert">{actionData.error}</p> : null}
      {actionData?.grantUrl ? (
        <p role="status">
          Evidence link ready until {actionData.expiresAt}:{" "}
          <a href={actionData.grantUrl}>open evidence</a>
        </p>
      ) : null}
      <section>
        <div className="curation-queue-heading">
          <div>
            <p className="eyebrow">Near-zero-touch queue</p>
            <h2>Queue</h2>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="claim-next" />
            <button type="submit">Review next ready submission</button>
          </Form>
        </div>
        {data.submissions.map((submission) => (
          <article
            id={`submission-${submission.submission.id}`}
            key={submission.submission.id}
            className="curator-record"
          >
            <h3>
              {submission.submission.publicReference} · {submission.submission.title}
            </h3>
            <p>
              {submission.submission.status} · {submission.submission.submitterEmail}
              {submission.submission.assignedCuratorEmail
                ? ` · assigned to ${submission.submission.assignedCuratorEmail}`
                : ""}
            </p>
            <p>{submission.rights.publicSummary}</p>
            {submission.submission.status === "listening" &&
            submission.submission.assignedCuratorId === data.identity.id ? (
              <CurationScorecard
                submissionId={submission.submission.id}
                audio={data.reviewAudio[submission.submission.id] ?? null}
              />
            ) : null}
            <div className="curator-actions">
              {!data.workflowAvailable ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="assign" />
                  <input type="hidden" name="submissionId" value={submission.submission.id} />
                  <button type="submit">Assign me</button>
                </Form>
              ) : null}
              {[
                "eligibility_review",
                ...(data.workflowAvailable ? [] : ["listening"]),
                "withdrawn",
              ].map((status) => (
                <Form method="post" key={`${submission.submission.id}-${status}`}>
                  <input type="hidden" name="intent" value="transition" />
                  <input type="hidden" name="submissionId" value={submission.submission.id} />
                  <input type="hidden" name="toStatus" value={status} />
                  <button type="submit">Move to {status.replace("_", " ")}</button>
                </Form>
              ))}
            </div>
            <Form method="post" className="curator-form">
              <input type="hidden" name="intent" value="note" />
              <input type="hidden" name="submissionId" value={submission.submission.id} />
              <label>
                Curator note
                <textarea name="message" rows={3} />
              </label>
              <button type="submit">Add note</button>
            </Form>
            <Form method="post" className="curator-form">
              <input type="hidden" name="intent" value="clarify" />
              <input type="hidden" name="submissionId" value={submission.submission.id} />
              <label>
                Claim key
                <input name="claimKey" placeholder="rights.authorityBasis" />
              </label>
              <label>
                Clarification request
                <textarea name="message" rows={3} />
              </label>
              <button type="submit">Request clarification</button>
            </Form>
            <h4>Evidence</h4>
            {submission.evidence.length ? (
              <ul>
                {submission.evidence.map((evidence) => (
                  <li key={evidence.id}>
                    {evidence.originalFilename} · {evidence.malwareStatus}
                    <Form method="post">
                      <input type="hidden" name="intent" value="grant-evidence" />
                      <input type="hidden" name="submissionId" value={submission.submission.id} />
                      <input type="hidden" name="evidenceId" value={evidence.id} />
                      <button type="submit">Create secure access link</button>
                    </Form>
                    <Form method="post" className="curator-form">
                      <input type="hidden" name="intent" value="malware" />
                      <input type="hidden" name="submissionId" value={submission.submission.id} />
                      <input type="hidden" name="evidenceId" value={evidence.id} />
                      <select name="malwareStatus" defaultValue={evidence.malwareStatus}>
                        <option value="pending_review">pending_review</option>
                        <option value="cleared">cleared</option>
                        <option value="quarantined">quarantined</option>
                        <option value="rejected">rejected</option>
                      </select>
                      <input name="message" placeholder="Optional evidence note" />
                      <button type="submit">Update evidence status</button>
                    </Form>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No evidence uploaded.</p>
            )}
            <h4>Activity</h4>
            <ul>
              {submission.activities.map((activity) => (
                <li key={activity.id}>
                  {activity.activityType} · {activity.actorEmail ?? activity.actorRole}
                  {activity.claimKey ? ` · ${activity.claimKey}` : ""}
                  {activity.message ? ` · ${activity.message}` : ""}
                </li>
              ))}
            </ul>
          </article>
        ))}
        <nav className="curation-pagination" aria-label="Submission queue pages">
          {data.page > 1 ? <Link to={pageHref(data.page - 1)}>Previous page</Link> : <span />}
          <span>Page {data.page}</span>
          {data.hasNextPage ? <Link to={pageHref(data.page + 1)}>Next page</Link> : <span />}
        </nav>
      </section>
    </main>
  );
}
