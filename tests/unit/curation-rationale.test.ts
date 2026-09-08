import { describe, expect, it } from "vitest";

import {
  CURATION_RATIONALE_MAX_CHARACTERS,
  curationRationaleError,
} from "../../app/types/curation";

describe("curation rationale bounds", () => {
  it("keeps the worst-case JSON-escaped decision payload below the outbox limit", () => {
    const rationale = "\0".repeat(CURATION_RATIONALE_MAX_CHARACTERS);
    const payload = {
      submissionId: crypto.randomUUID(),
      recipient: `${"x".repeat(240)}@example.test`,
      publicReference: `SUB-${"x".repeat(180)}`,
      grade: "A",
      status: "accepted",
      rationale,
    };

    expect(curationRationaleError(rationale)).toBeNull();
    expect(new TextEncoder().encode(JSON.stringify(payload)).byteLength).toBeLessThan(65_536);
  });

  it("rejects empty and overlong rationales", () => {
    expect(curationRationaleError("")).toBe("Decision rationale is required.");
    expect(curationRationaleError("x".repeat(CURATION_RATIONALE_MAX_CHARACTERS + 1))).toBe(
      "Decision rationale is too long.",
    );
  });
});
