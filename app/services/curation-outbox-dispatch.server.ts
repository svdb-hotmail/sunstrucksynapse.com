import type { Database } from "~/db/client.server";
import { createCurationOutboxRepository } from "~/repositories/curation-outbox.server";

import type { TransactionalEmailService } from "./transactional-email.server";

function decisionEmail(payload: Record<string, unknown>) {
  const recipient = payload.recipient;
  const publicReference = payload.publicReference;
  const status = payload.status;
  const grade = payload.grade;
  const rationale = payload.rationale;
  if (
    typeof recipient !== "string" ||
    typeof publicReference !== "string" ||
    (status !== "accepted" && status !== "rejected") ||
    (grade !== "A" && grade !== "B" && grade !== "C") ||
    typeof rationale !== "string"
  ) {
    return null;
  }
  const statusLabel = status === "accepted" ? "accepted for curator preparation" : "not selected";
  return {
    to: recipient,
    subject: `Submission ${status}: ${publicReference}`,
    textBody: `Your submission ${publicReference} was ${statusLabel}. Editorial grade: ${grade}.\n\n${rationale}\n\nPublication is a separate curator decision.`,
  };
}

export async function dispatchCurationOutbox(db: Database, email: TransactionalEmailService) {
  const outbox = createCurationOutboxRepository(db);
  const jobs = await outbox.claim({ limit: 10, leaseSeconds: 90 });
  const outcomes = await Promise.allSettled(
    jobs.map(async (job) => {
      if (job.kind !== "submission_decision_email") {
        await outbox.retry(job.id, job.leaseToken, "UNKNOWN_JOB_KIND", 3600);
        return;
      }
      const message = decisionEmail(job.payload);
      if (!message) {
        await outbox.retry(job.id, job.leaseToken, "INVALID_JOB_PAYLOAD", 3600);
        return;
      }
      try {
        await email.send(message);
        await outbox.acknowledge(job.id, job.leaseToken);
      } catch {
        await outbox.retry(job.id, job.leaseToken, "EMAIL_DELIVERY_FAILED", 60);
      }
    }),
  );
  return {
    claimed: jobs.length,
    completed: outcomes.filter((item) => item.status === "fulfilled").length,
  };
}
