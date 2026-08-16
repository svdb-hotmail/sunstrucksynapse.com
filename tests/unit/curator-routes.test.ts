import { beforeEach, describe, expect, it } from "vitest";
import type { ActionFunctionArgs } from "react-router";

import {
  cloudflareContext,
  type CloudflareContextValue,
} from "../../app/config/cloudflare-context.server";
import type { WorkerEnv } from "../../app/config/env.server";
import { createE2eCatalogueRepository } from "../../app/repositories/catalogue-fixture.server";
import { createE2eCuratorRepository } from "../../app/repositories/curator-fixture.server";
import type { CuratorRepository } from "../../app/repositories/curator.server";
import { action as entityAction } from "../../app/routes/curator-entities";
import { action as curatorAction } from "../../app/routes/curator";

interface ErrorResponseBody {
  readonly error?: string;
  readonly code?: string;
}

function isErrorResponseBody(value: unknown): value is ErrorResponseBody {
  return typeof value === "object" && value !== null;
}

async function readErrorResponse(response: Response): Promise<ErrorResponseBody> {
  const data: unknown = await response.json();
  if (!isErrorResponseBody(data)) {
    throw new Error("Expected JSON object in error response");
  }
  return data;
}

function createMockContext(repository: CuratorRepository): ActionFunctionArgs["context"] {
  const mockEnv: WorkerEnv = {
    DATABASE_URL: "postgres://localhost:5432/sunstruck_test",
    ACCESS_TEAM_DOMAIN: "https://auth.cloudflareaccess.com",
    ACCESS_AUD: "test-aud-secret",
    CURATOR_EMAILS: "curator@example.test",
    MEDIA_DELIVERY_SIGNING_SECRET: "test-signing-secret",
    MEDIA_BUCKET: {
      put: async () => ({ size: 0 }),
      head: async () => null,
      get: async () => null,
      delete: async () => {},
    },
  };

  const runtimeValue: CloudflareContextValue = {
    curatorRepository: repository,
    catalogueRepository: createE2eCatalogueRepository(),
    env: mockEnv,
    ctx: {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as unknown as ExecutionContext,
  };

  return {
    get<T>(key: unknown): T {
      if (key === cloudflareContext) {
        return runtimeValue as T;
      }
      throw new Error("Unknown context key");
    },
    set() {
      throw new Error("Context mutation unsupported in test");
    },
  };
}

describe("curator routes and actions status mappings", () => {
  let repository: CuratorRepository;
  let context: ActionFunctionArgs["context"];

  beforeEach(() => {
    repository = createE2eCuratorRepository();
    context = createMockContext(repository);
  });

  const authHeaders = {
    "x-test-curator-identity": "curator-1|curator@example.test",
  };

  describe("curator.tsx form action", () => {
    it("returns 400 on invalid form or parameters", async () => {
      // Invalid entity type
      const form1 = new FormData();
      form1.set("intent", "create");
      form1.set("entityType", "invalid_type");
      const res1 = await curatorAction({
        request: new Request("https://example.test/curator", {
          method: "POST",
          headers: authHeaders,
          body: form1,
        }),
        context,
        params: {},
      });
      expect(res1.status).toBe(400);

      // Invalid slug in form
      const form2 = new FormData();
      form2.set("intent", "create");
      form2.set("entityType", "artist");
      form2.set("title", "Test Artist");
      form2.set("slug", "INVALID SLUG!");
      const res2 = await curatorAction({
        request: new Request("https://example.test/curator", {
          method: "POST",
          headers: authHeaders,
          body: form2,
        }),
        context,
        params: {},
      });
      expect(res2.status).toBe(400);

      // Invalid entityId UUID
      const form3 = new FormData();
      form3.set("intent", "update");
      form3.set("entityType", "artist");
      form3.set("entityId", "not-a-uuid");
      form3.set("title", "Updated");
      form3.set("slug", "updated-artist");
      const res3 = await curatorAction({
        request: new Request("https://example.test/curator", {
          method: "POST",
          headers: authHeaders,
          body: form3,
        }),
        context,
        params: {},
      });
      expect(res3.status).toBe(400);
    });

    it("returns 404 on non-existent records", async () => {
      const nonExistentId = crypto.randomUUID();

      // Create track referencing non-existent release
      const form1 = new FormData();
      form1.set("intent", "create");
      form1.set("entityType", "track");
      form1.set("title", "Orphan Track");
      form1.set("slug", "orphan-track");
      form1.set("artistId", crypto.randomUUID());
      form1.set("releaseId", nonExistentId);
      form1.set("position", "1");
      const res1 = await curatorAction({
        request: new Request("https://example.test/curator", {
          method: "POST",
          headers: authHeaders,
          body: form1,
        }),
        context,
        params: {},
      });
      expect(res1.status).toBe(404);

      // Delete non-existent record
      const form2 = new FormData();
      form2.set("intent", "delete");
      form2.set("entityType", "artist");
      form2.set("entityId", nonExistentId);
      const res2 = await curatorAction({
        request: new Request("https://example.test/curator", {
          method: "POST",
          headers: authHeaders,
          body: form2,
        }),
        context,
        params: {},
      });
      expect(res2.status).toBe(404);
    });

    it("returns 409 on conflict and referenced constraints", async () => {
      const artist = await repository.create("artist", {
        slug: "route-artist",
        title: "Route Artist",
      });

      // Duplicate artist slug -> 409 conflict
      const form1 = new FormData();
      form1.set("intent", "create");
      form1.set("entityType", "artist");
      form1.set("title", "Duplicate Artist");
      form1.set("slug", "route-artist");
      const res1 = await curatorAction({
        request: new Request("https://example.test/curator", {
          method: "POST",
          headers: authHeaders,
          body: form1,
        }),
        context,
        params: {},
      });
      expect(res1.status).toBe(409);

      // Release referencing artist
      await repository.create("release", {
        slug: "route-release",
        title: "Route Release",
        artistId: artist.id,
      });

      // Deleting artist referenced by release -> 409 referenced
      const form2 = new FormData();
      form2.set("intent", "delete");
      form2.set("entityType", "artist");
      form2.set("entityId", artist.id);
      const res2 = await curatorAction({
        request: new Request("https://example.test/curator", {
          method: "POST",
          headers: authHeaders,
          body: form2,
        }),
        context,
        params: {},
      });
      expect(res2.status).toBe(409);
    });
  });

  describe("curator-entities.ts API action", () => {
    it("returns 400 on invalid JSON or parameters", async () => {
      const res = await entityAction({
        request: new Request("https://example.test/curator/api/entities/artist", {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ slug: "INVALID SLUG", title: "Test" }),
        }),
        context,
        params: { entityType: "artist" },
      });
      expect(res.status).toBe(400);
      const data = await readErrorResponse(res);
      expect(data.code).toBe("invalid");
    });

    it("returns 404 when target entity does not exist", async () => {
      const missingId = crypto.randomUUID();
      const res = await entityAction({
        request: new Request(`https://example.test/curator/api/entities/artist/${missingId}`, {
          method: "DELETE",
          headers: authHeaders,
        }),
        context,
        params: { entityType: "artist", entityId: missingId },
      });
      expect(res.status).toBe(404);
      const data = await readErrorResponse(res);
      expect(data.code).toBe("not_found");
    });

    it("returns 409 on conflict, referenced, and transition_conflict", async () => {
      const artist = await repository.create("artist", {
        slug: "api-artist",
        title: "API Artist",
      });

      // Duplicate slug -> 409 conflict
      const conflictRes = await entityAction({
        request: new Request("https://example.test/curator/api/entities/artist", {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ slug: "api-artist", title: "API Artist Duplicate" }),
        }),
        context,
        params: { entityType: "artist" },
      });
      expect(conflictRes.status).toBe(409);
      const conflictData = await readErrorResponse(conflictRes);
      expect(conflictData.code).toBe("conflict");

      // Add a release to reference the artist
      await repository.create("release", {
        slug: "api-release",
        title: "API Release",
        artistId: artist.id,
      });

      // Delete referenced artist -> 409 referenced
      const refRes = await entityAction({
        request: new Request(`https://example.test/curator/api/entities/artist/${artist.id}`, {
          method: "DELETE",
          headers: authHeaders,
        }),
        context,
        params: { entityType: "artist", entityId: artist.id },
      });
      expect(refRes.status).toBe(409);
      const refData = await readErrorResponse(refRes);
      expect(refData.code).toBe("referenced");
    });
  });
});
