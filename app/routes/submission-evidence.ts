import type { LoaderFunctionArgs } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import { SubmissionEvidenceService } from "~/services/submission-evidence.server";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  if (!runtime.submissionRepository || !runtime.db || !runtime.env) {
    throw new Response("Submission service unavailable.", { status: 503 });
  }
  const token = params.token;
  if (!token) {
    throw new Response("Evidence link not found.", { status: 404 });
  }
  const result = await new SubmissionEvidenceService(
    runtime.db,
    runtime.submissionRepository,
    runtime.env,
  ).openGrantedEvidence(token);
  if (!result.ok) {
    throw new Response(result.message, { status: result.status });
  }
  return result.value;
}
