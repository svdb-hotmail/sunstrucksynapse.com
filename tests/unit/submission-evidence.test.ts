import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../../app/db/schema";
import { submissionInvitations } from "../../app/db/schema";
import { createSubmissionRepository } from "../../app/repositories/submissions.server";
import {
  EVIDENCE_MAX_BYTE_SIZE,
  SubmissionEvidenceService,
  parseEvidenceDeclaration,
} from "../../app/services/submission-evidence.server";
import { sha256Hex } from "../../app/services/submission-security.server";
import type { WorkerEnv } from "../../app/config/env.server";

function completeDraft() {
  return {
    submissionKind: "track" as const,
    workTitle: "Evidence Song",
    artist: {
      displayName: "Evidence Artist",
      shortBiography: "",
      location: "",
      websiteUrl: "",
      socialUrl: "",
      priorWorkNotes: "",
    },
    release: {
      title: "Evidence Release",
      summary: "",
      plannedReleaseDate: "",
      labelName: "",
      distributorName: "",
      distributorReleaseId: "",
      territories: ["Worldwide"],
    },
    track: {
      title: "Evidence Song",
      versionTitle: "",
      durationNotes: "",
      isLeadSingle: true,
      lyricsSummary: "",
      isInstrumental: false,
    },
    contact: {
      contactName: "Evidence Artist",
      contactEmail: "evidence@example.test",
      contactPhone: "",
      preferredContactMethod: "email" as const,
    },
    acknowledgements: {
      invitationConfirmed: true,
      accuracyConfirmed: true,
      rightsConfirmed: true,
      disclosureConfirmed: true,
      reviewProcessConfirmed: true,
    },
    rights: {
      authorityBasis: "original_author" as const,
      authorityDetails: "",
      entitlementStatement: "I control the rights needed for review.",
      publicSummary: "Original work.",
      publicNotes: "",
      privateNotes: "",
      containsThirdPartyMaterial: false,
      thirdPartyMaterialDetails: "",
      restrictions: "",
      territories: ["Worldwide"],
      distributorName: "",
      distributorReleaseId: "",
      isrc: "",
      attestation: "I attest to this declaration.",
    },
    process: {
      aiUsed: true,
      aiUseDescription: "AI ideation.",
      meaningfulHumanContribution: "Human composition.",
      toolsAndSystems: ["Sketcher"],
      humanRoles: [
        {
          name: "Evidence Artist",
          role: "artist",
          contribution: "Composition",
          isPublic: true,
        },
      ],
      aiTools: [
        {
          name: "Sketcher",
          model: "v1",
          provider: "Example",
          purpose: "Ideation",
          isPublic: true,
        },
      ],
      lyricsUsed: false,
      lyricsDetails: "",
      voiceCloneUsed: false,
      voiceCloneDetails: "",
      samplesUsed: false,
      sampleDetails: "",
      sourceMaterialContext: "",
      publicSummary: "AI ideation, human completion.",
      privateNotes: "",
    },
    provenance: {
      summary: "Evidence provenance summary.",
      publicNotes: "",
      privateNotes: "",
      steps: [],
      sources: [],
    },
  };
}

function createMemoryEnv(): WorkerEnv {
  const objects = new Map<
    string,
    { bytes: Uint8Array; metadata: Record<string, string>; contentType: string }
  >();
  return {
    DATABASE_URL: "postgres://localhost/test",
    ACCESS_TEAM_DOMAIN: "https://auth.cloudflareaccess.com",
    ACCESS_AUD: "test-aud",
    CURATOR_EMAILS: "curator@example.test",
    MEDIA_DELIVERY_SIGNING_SECRET: "test-secret",
    MEDIA_BUCKET: {
      async put(key, value, options) {
        const reader = value.getReader();
        const parts: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          if (chunk) {
            parts.push(chunk);
            size += chunk.byteLength;
          }
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const part of parts) {
          bytes.set(part, offset);
          offset += part.byteLength;
        }
        objects.set(key, {
          bytes,
          metadata: options.customMetadata,
          contentType: options.httpMetadata.contentType,
        });
        return { size };
      },
      async head(key) {
        const object = objects.get(key);
        return object ? { size: object.bytes.byteLength, customMetadata: object.metadata } : null;
      },
      async get(key) {
        const object = objects.get(key);
        if (!object) return null;
        return {
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(object.bytes);
              controller.close();
            },
          }),
          size: object.bytes.byteLength,
          httpEtag: `"${key}"`,
          writeHttpMetadata(headers: Headers) {
            headers.set("content-type", object.contentType);
          },
        };
      },
      async delete(key) {
        objects.delete(key);
      },
    },
  };
}

describe("submission evidence service", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: ReturnType<typeof createSubmissionRepository>;
  let env: WorkerEnv;
  let tokenHash: string;

  beforeEach(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    repository = createSubmissionRepository(db as never);
    env = createMemoryEnv();
    tokenHash = sha256Hex("evidence-token");
    await db.insert(submissionInvitations).values({
      id: "6f000000-0000-4000-8000-000000000099",
      publicReference: "INV-EVIDENCE-001",
      tokenHash,
      inviteeName: "Evidence Artist",
      inviteeEmail: "evidence@example.test",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    });
    await repository.saveDraftByInvitationTokenHash(
      tokenHash,
      completeDraft(),
      new Date("2026-08-16T12:00:00Z"),
      { honeypotTriggered: false, userAgent: "vitest", ipHash: null },
      "Saved draft",
    );
  }, 30_000);

  afterEach(async () => {
    await client.close();
  }, 30_000);

  it("enforces the public evidence MIME allowlist and 20 MiB declaration boundary", () => {
    expect(
      parseEvidenceDeclaration({
        filename: "boundary.txt",
        mimeType: "text/plain",
        checksumSha256: sha256Hex("boundary evidence"),
        byteSize: EVIDENCE_MAX_BYTE_SIZE,
      }),
    ).toEqual({
      ok: true,
      value: {
        filename: "boundary.txt",
        mimeType: "text/plain",
        checksumSha256: sha256Hex("boundary evidence"),
        byteSize: EVIDENCE_MAX_BYTE_SIZE,
      },
    });

    expect(
      parseEvidenceDeclaration({
        filename: "vector.svg",
        mimeType: "image/svg+xml",
        checksumSha256: sha256Hex("vector evidence"),
        byteSize: 1,
      }),
    ).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported evidence MIME type.",
    });

    expect(
      parseEvidenceDeclaration({
        filename: "archive.zip",
        mimeType: "application/zip",
        checksumSha256: sha256Hex("archive evidence"),
        byteSize: 1,
      }),
    ).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported evidence MIME type.",
    });

    expect(
      parseEvidenceDeclaration({
        filename: "oversize.pdf",
        mimeType: "application/pdf",
        checksumSha256: sha256Hex("oversize evidence"),
        byteSize: EVIDENCE_MAX_BYTE_SIZE + 1,
      }),
    ).toEqual({
      ok: false,
      status: 413,
      message: "Evidence exceeds the 20 MiB limit.",
    });
  });

  it("rejects uploads from declared sessions that are unsupported or oversized", async () => {
    const service = new SubmissionEvidenceService(
      db as never,
      repository,
      env,
      () => new Date("2026-08-16T12:00:00Z"),
    );

    const unsupported = await service.createSession(tokenHash, {
      filename: "chain-of-title.svg",
      mimeType: "image/svg+xml",
      checksumSha256: sha256Hex("unsupported evidence"),
      byteSize: 1,
    });
    expect(unsupported).not.toBeNull();
    if (!unsupported) return;

    await expect(
      service.upload(
        unsupported.id,
        new Request("https://example.test/upload", {
          method: "PUT",
          headers: {
            "content-type": "image/svg+xml",
            "content-length": "1",
          },
          body: new Blob(["x"]).stream(),
          duplex: "half",
        } as RequestInit),
      ),
    ).resolves.toEqual({
      ok: false,
      status: 400,
      message: "Unsupported evidence MIME type.",
    });

    const oversized = await service.createSession(tokenHash, {
      filename: "too-big.pdf",
      mimeType: "application/pdf",
      checksumSha256: sha256Hex("oversized evidence"),
      byteSize: EVIDENCE_MAX_BYTE_SIZE + 1,
    });
    expect(oversized).not.toBeNull();
    if (!oversized) return;

    await expect(
      service.upload(
        oversized.id,
        new Request("https://example.test/upload", {
          method: "PUT",
          headers: {
            "content-type": "application/pdf",
            "content-length": String(EVIDENCE_MAX_BYTE_SIZE + 1),
          },
          body: new Blob(["x"]).stream(),
          duplex: "half",
        } as RequestInit),
      ),
    ).resolves.toEqual({
      ok: false,
      status: 413,
      message: "Evidence exceeds the 20 MiB limit.",
    });
  });

  it("stores private evidence metadata, grants short-lived curator access, and never exposes object keys in repository summaries", async () => {
    const service = new SubmissionEvidenceService(
      db as never,
      repository,
      env,
      () => new Date("2026-08-16T12:00:00Z"),
    );
    const session = await service.createSession(tokenHash, {
      filename: "chain-of-title.txt",
      mimeType: "text/plain",
      checksumSha256: sha256Hex("private evidence"),
      byteSize: 16,
    });
    expect(session).not.toBeNull();
    if (!session) return;

    const uploadRequest = new Request("https://example.test/upload", {
      method: "PUT",
      headers: {
        "content-type": "text/plain",
        "content-length": "16",
      },
      body: new Blob(["private evidence"]).stream(),
      duplex: "half",
    } as RequestInit);
    await expect(service.upload(session.id, uploadRequest)).resolves.toEqual({
      ok: true,
      value: null,
    });
    await expect(service.complete(session.id)).resolves.toMatchObject({
      ok: true,
      value: { evidenceId: expect.any(String) },
    });

    const aggregate = await repository.findByInvitationTokenHash(
      tokenHash,
      new Date("2026-08-16T12:01:00Z"),
    );
    expect(aggregate?.evidence).toHaveLength(1);
    expect(JSON.stringify(aggregate)).not.toContain("private/evidence/");
    expect(aggregate?.evidence[0]?.malwareStatus).toBe("pending_review");

    const grant = await service.createCuratorAccessGrant(aggregate!.evidence[0]!.id, {
      id: "curator-1",
      email: "curator@example.test",
    });
    expect(grant.ok).toBe(true);
    if (!grant.ok) return;

    const opened = await service.openGrantedEvidence(grant.value.token);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(await opened.value.text()).toBe("private evidence");
  });
});
