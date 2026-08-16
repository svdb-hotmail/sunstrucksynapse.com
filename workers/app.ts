import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext } from "../app/config/cloudflare-context.server";
import { validateWorkerEnv } from "../app/config/env.server";
import { createDatabase } from "../app/db/client.server";
import { createE2eCatalogueRepository } from "../app/repositories/catalogue-fixture.server";
import { createCatalogueRepository } from "../app/repositories/catalogue.server";
import { createE2eCuratorRepository } from "../app/repositories/curator-fixture.server";
import { createCuratorRepository } from "../app/repositories/curator.server";
import { createE2eSubmissionRepository } from "../app/repositories/submissions-fixture.server";
import { createSubmissionRepository } from "../app/repositories/submissions.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);
export const e2eCuratorRepository = createE2eCuratorRepository();
export const e2eSubmissionRepository = createE2eSubmissionRepository();

const testEnv = {
  DATABASE_URL: "postgres://localhost:5432/test",
  ACCESS_TEAM_DOMAIN: "https://auth.cloudflareaccess.com",
  ACCESS_AUD: "test-aud",
  CURATOR_EMAILS: "curator@example.test,auditor@example.test",
  MEDIA_DELIVERY_SIGNING_SECRET: "test-signing-secret",
  MEDIA_BUCKET: {
    objects: new Map<
      string,
      { bytes: Uint8Array; contentType: string; metadata: Record<string, string> }
    >(),
    async put(
      key: string,
      value: ReadableStream<Uint8Array>,
      options: {
        httpMetadata: { contentType: string };
        customMetadata: Record<string, string>;
        sha256: string;
      },
    ) {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        if (chunk) {
          chunks.push(chunk);
          size += chunk.byteLength;
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      this.objects.set(key, {
        bytes,
        contentType: options.httpMetadata.contentType,
        metadata: options.customMetadata,
      });
      return { size };
    },
    async head(key: string) {
      const value = this.objects.get(key);
      return value ? { size: value.bytes.byteLength, customMetadata: value.metadata } : null;
    },
    async get(key: string) {
      const value = this.objects.get(key);
      if (!value) return null;
      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(value.bytes);
            controller.close();
          },
        }),
        size: value.bytes.byteLength,
        httpEtag: `"${key}"`,
        writeHttpMetadata(headers: Headers) {
          headers.set("content-type", value.contentType);
        },
      };
    },
    async delete(key: string) {
      this.objects.delete(key);
    },
  },
};

export default {
  fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    if (import.meta.env.MODE === "test") {
      context.set(cloudflareContext, {
        catalogueRepository: createE2eCatalogueRepository(),
        curatorRepository: e2eCuratorRepository,
        submissionRepository: e2eSubmissionRepository,
        env: testEnv,
        ctx,
      });
      return requestHandler(request, context);
    }

    let validatedEnv;
    try {
      validatedEnv = validateWorkerEnv(env);
    } catch {
      return new Response("Server configuration error.", {
        status: 500,
        statusText: "Internal Server Error",
      });
    }

    const db = createDatabase(validatedEnv);
    context.set(cloudflareContext, {
      db,
      catalogueRepository: createCatalogueRepository(db, {
        signingSecret: validatedEnv.MEDIA_DELIVERY_SIGNING_SECRET,
      }),
      curatorRepository: createCuratorRepository(db),
      submissionRepository: createSubmissionRepository(db),
      env: validatedEnv,
      ctx,
    });

    return requestHandler(request, context);
  },
  async scheduled(controller, env, _ctx) {
    if (import.meta.env.MODE === "test") {
      const now = controller?.scheduledTime ? new Date(controller.scheduledTime) : new Date();
      await e2eCuratorRepository.publishScheduled(now);
      return;
    }

    const validatedEnv = validateWorkerEnv(env);
    const db = createDatabase(validatedEnv);
    const curatorRepository = createCuratorRepository(db);
    const now = controller?.scheduledTime ? new Date(controller.scheduledTime) : new Date();
    await curatorRepository.publishScheduled(now);
  },
} satisfies ExportedHandler<Env>;
