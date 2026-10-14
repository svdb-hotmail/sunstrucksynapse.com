import { afterEach, describe, expect, it, vi } from "vitest";

import { readUploadResponse, sendUploadRequest } from "../../app/utils/upload-response";

afterEach(() => vi.unstubAllGlobals());

describe("upload responses", () => {
  it("reports a useful retry message for a provider HTML error page", async () => {
    const response = new Response("<html>Worker exceeded CPU time limit</html>", {
      status: 503,
      headers: { "content-type": "text/html" },
    });
    await expect(
      readUploadResponse(response, "Verification was interrupted. Try upload again."),
    ).rejects.toThrow("Verification was interrupted. Try upload again.");
  });

  it("preserves an actionable application rejection", async () => {
    await expect(
      readUploadResponse(
        Response.json({ error: "Wait before trying again." }, { status: 429 }),
        "Upload failed.",
      ),
    ).rejects.toThrow("Wait before trying again.");
  });

  it.each([null, [], "invalid"])("rejects a malformed success response", async (value) => {
    await expect(
      readUploadResponse(Response.json(value), "Invalid upload response."),
    ).rejects.toThrow("Invalid upload response.");
  });

  it("returns the successful upload declaration", async () => {
    const declaration = { sessionId: "session", uploadUrl: "https://storage.example.test/upload" };
    await expect(readUploadResponse(Response.json(declaration), "Upload failed.")).resolves.toEqual(
      declaration,
    );
  });

  it.each([
    new TypeError("Load failed"),
    new DOMException("The string did not match the expected pattern.", "SyntaxError"),
  ])("replaces opaque browser request errors with the current upload stage", async (error) => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(
      sendUploadRequest(
        "/submit/test/review-audio/session",
        { method: "POST" },
        "Finishing upload was interrupted. Try upload again.",
      ),
    ).rejects.toThrow("Finishing upload was interrupted. Try upload again.");
  });
});
