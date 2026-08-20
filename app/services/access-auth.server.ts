import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from "jose";

import type { WorkerEnv } from "~/config/env.server";
import type { CuratorIdentity } from "~/types/curator";

export type AuthResult =
  | { ok: true; identity: CuratorIdentity }
  | { ok: false; response: Response };

const TEST_IDENTITY_HEADER = "x-test-curator-identity";
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function unauthorized(): AuthResult {
  return {
    ok: false,
    response: new Response("Authentication required.", { status: 401 }),
  };
}

function forbidden(): AuthResult {
  return {
    ok: false,
    response: new Response("Curator access denied.", { status: 403 }),
  };
}

function tokenFromRequest(request: Request): string | null {
  const asserted = request.headers.get("cf-access-jwt-assertion");
  if (asserted) return asserted;
  const cookie = request.headers.get("cookie");
  return cookie?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1] ?? null;
}

function identityFromPayload(payload: JWTPayload): CuratorIdentity | null {
  if (
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    typeof payload.email !== "string" ||
    !payload.email.includes("@")
  ) {
    return null;
  }
  return { id: payload.sub, email: payload.email.toLowerCase() };
}

export async function requireCuratorIdentity(
  request: Request,
  env?: WorkerEnv,
): Promise<AuthResult> {
  if (import.meta.env.MODE === "test") {
    const testIdentity = request.headers.get(TEST_IDENTITY_HEADER);
    if (testIdentity) {
      const [id, email] = testIdentity.split("|");
      if (id && email?.includes("@")) {
        return { ok: true, identity: { id, email: email.toLowerCase() } };
      }
      return unauthorized();
    }
  }

  if (!env) return unauthorized();
  const token = tokenFromRequest(request);
  if (!token) return unauthorized();

  const issuer = env.ACCESS_TEAM_DOMAIN;
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksByIssuer.set(issuer, jwks);
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    const identity = identityFromPayload(payload);
    if (!identity) return unauthorized();
    const curators = new Set(
      env.CURATOR_EMAILS.split(",").map((email) => email.trim().toLowerCase()),
    );
    return curators.has(identity.email) ? { ok: true, identity } : forbidden();
  } catch (error) {
    if (error instanceof errors.JOSEError) return unauthorized();
    throw error;
  }
}
