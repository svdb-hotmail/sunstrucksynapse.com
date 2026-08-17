import { cloudflareContext } from "~/config/cloudflare-context.server";
import { playbackEventNames, type PlaybackEventInput } from "~/types/analytics";
import { isbot } from "isbot";

import type { Route } from "./+types/api-events";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validOptionalUuid(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && UUID.test(value));
}

function parseEvent(value: unknown): PlaybackEventInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<PlaybackEventInput>;
  const occurredAt = new Date(String(input.occurredAt));
  if (
    typeof input.eventId !== "string" ||
    !UUID.test(input.eventId) ||
    typeof input.anonymousSessionId !== "string" ||
    !UUID.test(input.anonymousSessionId) ||
    !playbackEventNames.includes(input.eventName as PlaybackEventInput["eventName"]) ||
    !validOptionalUuid(input.trackId) ||
    !validOptionalUuid(input.collectionId) ||
    (input.progressSeconds !== undefined &&
      (!Number.isInteger(input.progressSeconds) || input.progressSeconds < 0)) ||
    Number.isNaN(occurredAt.valueOf()) ||
    Math.abs(Date.now() - occurredAt.valueOf()) > 86_400_000
  ) {
    return null;
  }
  return input as PlaybackEventInput;
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function action({ request, context }: Route.ActionArgs) {
  const runtime = context.get(cloudflareContext);
  const repository = runtime.analyticsRepository;
  if (!repository || !runtime.rateLimitRepository) return new Response(null, { status: 503 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return new Response(null, { status: 415 });
  }
  let event: PlaybackEventInput | null = null;
  try {
    event = parseEvent(await request.json());
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!event) return new Response(null, { status: 400 });
  const anonymousSessionHash = await sha256(event.anonymousSessionId);
  const rateLimit = await runtime.rateLimitRepository.consume(
    "analytics",
    anonymousSessionHash,
    120,
    60,
  );
  if (!rateLimit.allowed) {
    return new Response(null, {
      status: 429,
      headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
    });
  }
  await repository.record({
    ...event,
    anonymousSessionHash,
    isBot: isbot(request.headers.get("user-agent") ?? ""),
  });
  return new Response(null, { status: 202 });
}
