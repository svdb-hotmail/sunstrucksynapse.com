import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../../app/db/schema";
import { createSubmissionRepository } from "../../app/repositories/submissions.server";
import { sha256Hex } from "../../app/services/submission-security.server";

describe("submission invitation repository", () => {
  let client: PGlite;
  let repository: ReturnType<typeof createSubmissionRepository>;

  beforeEach(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    repository = createSubmissionRepository(db as never);
  }, 30_000);

  afterEach(async () => {
    await client.close();
  }, 30_000);

  it("persists an invitation that can be retrieved only by its token hash", async () => {
    const rawToken = "secure-test-token";
    const tokenHash = sha256Hex(rawToken);
    const issuedAt = new Date("2026-09-09T00:00:00Z");
    const invitation = await repository.createInvitation(
      {
        publicReference: "INV-TEST-NEW-001",
        tokenHash,
        inviteeName: "New Signal",
        inviteeEmail: "new@example.test",
        expiresAt: new Date("2026-10-01T00:00:00Z"),
      },
      { id: "curator-1", email: "curator@example.test" },
      issuedAt,
    );

    const audit = await client.query<{
      invitation_id: string;
      actor_id: string;
      actor_email: string;
      issued_at: Date;
    }>(
      `select invitation_id, actor_id, actor_email, issued_at
       from submission_invitation_issuance_audit
       where invitation_id = $1`,
      [invitation.id],
    );
    expect(audit.rows).toEqual([
      {
        invitation_id: invitation.id,
        actor_id: "curator-1",
        actor_email: "curator@example.test",
        issued_at: issuedAt,
      },
    ]);

    await expect(
      repository.findInvitationByTokenHash(tokenHash, new Date("2026-09-09T00:00:00Z")),
    ).resolves.toMatchObject({ id: invitation.id, publicReference: "INV-TEST-NEW-001" });
    await expect(
      repository.findInvitationByTokenHash(rawToken, new Date("2026-09-09T00:00:00Z")),
    ).resolves.toBeNull();
    await expect(
      client.query(
        `update submission_invitation_issuance_audit
         set actor_email = 'tampered@example.test'
         where invitation_id = $1`,
        [invitation.id],
      ),
    ).rejects.toThrow(/immutable/i);
    await expect(
      client.query(
        `delete from submission_invitation_issuance_audit
         where invitation_id = $1`,
        [invitation.id],
      ),
    ).rejects.toThrow(/immutable/i);
  });
});
