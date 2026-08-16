import { describe, expect, it } from "vitest";

import { catalogueLoadingMessage, catalogueStateCopy } from "../../app/services/catalogue";

describe("catalogue states", () => {
  it("announces the loading state", () => {
    expect(catalogueLoadingMessage).toContain("Loading the catalogue");
  });

  it("renders an intentional empty state", () => {
    const copy = catalogueStateCopy({ status: "empty", items: [], collections: [] });

    expect(copy).toEqual({
      heading: "No transmissions are published yet.",
      message: "The first listening selections will appear here when they are ready.",
    });
  });

  it("renders a sanitized database failure state", () => {
    const copy = catalogueStateCopy({
      status: "error",
      items: [],
      collections: [],
      message: "The catalogue is temporarily unavailable. Please try again shortly.",
    });

    expect(copy.heading).toBe("Signal interrupted");
    expect(copy.message).toContain("temporarily unavailable");
  });
});
