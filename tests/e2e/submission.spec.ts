import { expect, test } from "@playwright/test";

test("saves a practical invited draft and requires private review audio before submission", async ({
  browser,
  page,
}) => {
  await page.goto("/submit/phase3-invite-token");
  await expect(page.getByRole("heading", { name: "Send us one track" })).toBeVisible();
  await expect(page.getByLabel("Public rights summary")).toHaveCount(0);
  await page.getByLabel("Artist name").fill("Invited Artist");
  await page.getByLabel("Track title").fill("Playwright Orbit");
  await page
    .getByLabel("How was this track made, and what did you contribute?")
    .fill("Human composition, editing, and final production.");
  await page.getByLabel("AI tools used (comma separated)").fill("Sketcher");
  await page.getByLabel(/This invitation is mine/).check();
  await page.getByRole("button", { name: "Save details and continue" }).click();

  await expect(page.getByText("Draft saved.")).toBeVisible();
  await expect(page.getByLabel("Audio file")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Submit track for review" })).toBeDisabled();

  const directSubmit = await page.evaluate(async () => {
    const form = document.querySelector<HTMLFormElement>("#submission-details-form");
    if (!form) throw new Error("Submission details form not found.");
    const body = new FormData(form);
    body.set("intent", "submit");
    const response = await fetch(window.location.pathname, {
      method: "POST",
      body,
      redirect: "manual",
    });
    return {
      status: response.status,
      payload: (await response.json()) as { error?: string },
    };
  });
  expect(directSubmit).toEqual({
    status: 409,
    payload: { error: "Upload a private listening copy before submitting." },
  });

  const curatorContext = await browser.newContext({
    extraHTTPHeaders: {
      "x-test-curator-identity": "curator-1|curator@example.test",
    },
  });
  const curatorPage = await curatorContext.newPage();
  await curatorPage.goto("/curator/submissions");
  await expect(curatorPage.getByText("Playwright Orbit")).toBeVisible();

  const submissionCard = curatorPage.locator(".curator-record").filter({
    hasText: "Playwright Orbit",
  });
  await expect(submissionCard).toContainText("draft");
  await expect(submissionCard.getByRole("button", { name: "Assign me" })).toHaveCount(0);
  await expect(submissionCard.getByRole("button", { name: "Move to listening" })).toHaveCount(0);
  await expect(submissionCard.getByRole("button", { name: "Finalize decision" })).toHaveCount(0);
  await curatorContext.close();
});
