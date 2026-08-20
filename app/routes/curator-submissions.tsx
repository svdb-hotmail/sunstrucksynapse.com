import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import { requireCuratorIdentity } from "~/services/access-auth.server";
import { SubmissionEvidenceService } from "~/services/submission-evidence.server";
import { SubmissionService, submissionHttpStatus } from "~/services/submissions.server";
import { createTransactionalEmailService } from "~/services/transactional-email.server";
import { validateUuid } from "~/services/curator-validation";
import type { SubmissionStatus } from "~/types/submissions";

import type { Route } from "./+types/curator-submissions";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  const auth = await requireCuratorIdentity(request, runtime.env);
  if (!auth.ok) throw auth.response;
  if (!runtime.submissionRepository || !runtime.curatorRepository) {
    throw new Response("Submission service unavailable.", { status: 503 });
  }
  const url = new URL(request.url);
  const filter = {
    status: (url.searchParams.get("status") ?? "all") as SubmissionStatus | "all",
    assignedTo: url.searchParams.get("assignedTo") ?? "all",
  };
  const [submissions, releases, tracks] = await Promise.all([
    runtime.submissionRepository.listCuratorSubmissions(filter),
    runtime.curatorRepository.list("release"),
    runtime.curatorRepository.list("track"),
  ]);
  return {
    identity: auth.identity,
    submissions,
    releases,
    tracks,
    flash: url.searchParams.get("flash"),
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
  const form = await request.formData();
  const submissionIdResult = validateUuid(form.get("submissionId"), "submissionId");
  if (!submissionIdResult.ok) return bad(submissionIdResult.fieldErrors.submissionId);
  const submissionId = submissionIdResult.value;
  const intent = String(form.get("intent") ?? "");

  if (intent === "assign") {
    await service.assignCurator(submissionId, auth.identity);
    return redirect("/curator/submissions?flash=assigned");
  }
  if (intent === "transition") {
    const toStatus = String(form.get("toStatus") ?? "");
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
  if (intent === "accept") {
    const releaseValue = String(form.get("resultingReleaseId") ?? "").trim();
    const trackValue = String(form.get("resultingTrackId") ?? "").trim();
    const releaseId = releaseValue ? validateUuid(releaseValue, "resultingReleaseId") : null;
    const trackId = trackValue ? validateUuid(trackValue, "resultingTrackId") : null;
    if (releaseId && !releaseId.ok) return bad(releaseId.fieldErrors.resultingReleaseId);
    if (trackId && !trackId.ok) return bad(trackId.fieldErrors.resultingTrackId);
    const result = await service.accept({
      submissionId,
      actor: auth.identity,
      acceptedAt: new Date(),
      note: String(form.get("message") ?? "").trim() || null,
      resultingReleaseId: releaseId?.ok ? releaseId.value : null,
      resultingTrackId: trackId?.ok ? trackId.value : null,
    });
    if (!result.ok) return bad(result.error.message, submissionHttpStatus(result.error.code));
    return redirect("/curator/submissions?flash=accepted");
  }
  if (intent === "reject") {
    const result = await service.reject({
      submissionId,
      actor: auth.identity,
      rejectedAt: new Date(),
      reason: String(form.get("reason") ?? "").trim(),
    });
    if (!result.ok) return bad(result.error.message, submissionHttpStatus(result.error.code));
    return redirect("/curator/submissions?flash=rejected");
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

export const meta: Route.MetaFunction = () => [
  { title: "Curator submissions | Sunstruck Synapse Radio" },
];

export default function CuratorSubmissionsRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string; grantUrl?: string; expiresAt?: string }>();
  return (
    <main className="curator-workspace">
      <p className="eyebrow">Curator workspace</p>
      <h1>Submission review</h1>
      <p>Signed in as {data.identity.email}</p>
      {data.flash ? <p role="status">{data.flash}</p> : null}
      {actionData?.error ? <p role="alert">{actionData.error}</p> : null}
      {actionData?.grantUrl ? (
        <p role="status">
          Evidence link ready until {actionData.expiresAt}:{" "}
          <a href={actionData.grantUrl}>open evidence</a>
        </p>
      ) : null}
      <section>
        <h2>Queue</h2>
        {data.submissions.map((submission) => (
          <article key={submission.submission.id} className="curator-record">
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
            <div className="curator-actions">
              <Form method="post">
                <input type="hidden" name="intent" value="assign" />
                <input type="hidden" name="submissionId" value={submission.submission.id} />
                <button type="submit">Assign me</button>
              </Form>
              {["eligibility_review", "listening", "withdrawn"].map((status) => (
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
            <Form method="post" className="curator-form">
              <input type="hidden" name="intent" value="accept" />
              <input type="hidden" name="submissionId" value={submission.submission.id} />
              <label>
                Resulting release
                <select
                  name="resultingReleaseId"
                  defaultValue={submission.submission.resultingReleaseId ?? ""}
                >
                  <option value="">No linked release</option>
                  {data.releases.map((release) => (
                    <option key={release.id} value={release.id}>
                      {release.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Resulting track
                <select
                  name="resultingTrackId"
                  defaultValue={submission.submission.resultingTrackId ?? ""}
                >
                  <option value="">No linked track</option>
                  {data.tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Acceptance note
                <textarea name="message" rows={2} defaultValue="" />
              </label>
              <button type="submit">Accept</button>
            </Form>
            <Form method="post" className="curator-form">
              <input type="hidden" name="intent" value="reject" />
              <input type="hidden" name="submissionId" value={submission.submission.id} />
              <label>
                Rejection reason
                <textarea name="reason" rows={2} />
              </label>
              <button type="submit">Reject</button>
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
      </section>
    </main>
  );
}
