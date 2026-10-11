import {
  redirect,
  useLoaderData,
  useFetcher,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { SITE_NAME } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { ProductionQueue } from "~/features/curator-workspace/ProductionQueue";
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

interface CuratorSubmissionActionData {
  error?: string;
  grantUrl?: string;
  invitationUrl?: string;
  invitationReference?: string;
  expiresAt?: string;
}

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
  const selectedId = url.searchParams.get("review");
  if (
    selectedId &&
    validateUuid(selectedId, "review").ok &&
    !submissions.some((row) => row.submission.id === selectedId)
  ) {
    const selected = await runtime.submissionRepository.findCuratorSubmission(selectedId);
    if (selected) submissions.push(selected);
  }
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
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
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
  if (intent === "create-invitation") {
    const result = await service.createInvitation(
      {
        inviteeName: String(form.get("inviteeName") ?? ""),
        inviteeEmail: String(form.get("inviteeEmail") ?? ""),
        expiresInDays: Number(form.get("expiresInDays")),
      },
      auth.identity,
    );
    if (!result.ok) return bad(result.error.message, submissionHttpStatus(result.error.code));
    const invitationUrl = new URL(request.url);
    invitationUrl.pathname = `/submit/${encodeURIComponent(result.value.token)}`;
    invitationUrl.search = "";
    invitationUrl.hash = "";
    return Response.json(
      {
        invitationUrl: invitationUrl.toString(),
        invitationReference: result.value.invitation.publicReference,
        expiresAt: result.value.invitation.expiresAt.toISOString(),
      } satisfies CuratorSubmissionActionData,
      { headers: { "cache-control": "no-store" } },
    );
  }
  if (intent === "claim-next") {
    if (!workflow) return bad("Curation workflow unavailable.", 503);
    const requested = form.get("requestedId");
    if (requested && !validateUuid(requested, "requestedId").ok)
      return bad("Invalid submission ID.");
    const submissionId = await workflow.claimNextSubmission(
      auth.identity,
      new Date(),
      requested ? String(requested) : undefined,
    );
    if (form.get("workspace") === "1")
      return Response.json(
        { claimedId: submissionId },
        { headers: { "cache-control": "no-store" } },
      );
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
    if (form.get("workspace") === "1") {
      const claimedId = await workflow.claimNextSubmission(auth.identity, new Date());
      return Response.json(
        { finalizedId: submissionId, claimedId },
        { headers: { "cache-control": "no-store" } },
      );
    }
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
    if (form.get("workspace") === "1" && workflow) {
      return Response.json(
        { claimedId: await workflow.claimNextSubmission(auth.identity, new Date()) },
        { headers: { "cache-control": "no-store" } },
      );
    }
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
  const invitation = useFetcher<CuratorSubmissionActionData>();
  return (
    <ProductionQueue
      data={data}
      invitation={
        <details className="curator-panel">
          <summary>Create a private submission link</summary>
          <invitation.Form method="post" className="curator-form">
            <input type="hidden" name="intent" value="create-invitation" />
            <label>
              Name
              <input name="inviteeName" maxLength={200} />
            </label>
            <label>
              Email
              <input name="inviteeEmail" type="email" required maxLength={320} />
            </label>
            <label>
              Expires after
              <select name="expiresInDays" defaultValue="30">
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </label>
            <button disabled={invitation.state !== "idle"}>Create private link</button>
          </invitation.Form>
          {invitation.data?.error ? <p role="alert">{invitation.data.error}</p> : null}
          {invitation.data?.invitationUrl ? (
            <p role="status">
              Shown once:{" "}
              <a href={invitation.data.invitationUrl}>{invitation.data.invitationUrl}</a> · expires{" "}
              {invitation.data.expiresAt}
            </p>
          ) : null}
        </details>
      }
    />
  );
}
