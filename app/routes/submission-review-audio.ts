import type { ActionFunctionArgs } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import { createCurationWorkflowRepository } from "~/repositories/curation-workflow.server";
import { ReviewAudioService, parseReviewAudioDeclaration } from "~/services/review-audio.server";
import { sha256Hex } from "~/services/submission-security.server";

export async function action({ request, context, params }: ActionFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  if (!runtime.db || !runtime.env || !runtime.rateLimitRepository) {
    return Response.json({ error: "Review-audio upload is unavailable." }, { status: 503 });
  }
  const tokenHash = sha256Hex(params.invitationToken ?? "");
  const rateLimit = await runtime.rateLimitRepository.consume("review_audio", tokenHash, 20, 300);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many upload requests. Wait before trying again." },
      { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } },
    );
  }
  const service = new ReviewAudioService(createCurationWorkflowRepository(runtime.db), runtime.env);
  const sessionId = params.sessionId;
  if (sessionId) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
    ) {
      return Response.json({ error: "Audio upload session is invalid." }, { status: 400 });
    }
    const result = await service.finalize(tokenHash, sessionId);
    return result.ok
      ? Response.json({ audio: result.value })
      : Response.json({ error: result.message }, { status: result.status });
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid audio declaration." }, { status: 400 });
  }
  const declaration = parseReviewAudioDeclaration(input);
  if (!declaration.ok) {
    return Response.json({ error: declaration.message }, { status: declaration.status });
  }
  const result = await service.createUpload(tokenHash, declaration.value);
  return result.ok
    ? Response.json(result.value)
    : Response.json({ error: result.message }, { status: result.status });
}
