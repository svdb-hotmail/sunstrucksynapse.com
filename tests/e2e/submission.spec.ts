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
  await page.getByLabel("Samples or source recordings").check();
  await page
    .getByLabel(/Rights details/)
    .fill("Private licence agreement LIC-8472 with a session musician.");
  await page.getByLabel(/This invitation is mine/).check();
  await page.getByRole("button", { name: /Save (details and continue|changes)/ }).click();

  await expect(page.getByText("Draft saved.")).toBeVisible();
  await expect(page.getByLabel("Audio file")).toBeEnabled();
  const submitButton = page.getByRole("button", { name: "Submit track for review" });
  await expect(submitButton).toBeDisabled();

  // Bypass only the presentation lock to prove the action independently enforces the audio gate.
  await submitButton.evaluate((button) => {
    (button as HTMLButtonElement).disabled = false;
  });
  await submitButton.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Upload a private listening copy before submitting.",
  );

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
  const publicRightsSummary = submissionCard.locator("p").filter({
    hasText: "The submitter identifies the work as original and under their control.",
  });
  await expect(publicRightsSummary).toContainText(
    "The track includes disclosed sample or source material.",
  );
  await expect(publicRightsSummary).not.toContainText("LIC-8472");
  await expect(submissionCard.getByRole("button", { name: "Assign me" })).toHaveCount(0);
  await expect(submissionCard.getByRole("button", { name: "Move to listening" })).toHaveCount(0);
  await expect(submissionCard.getByRole("button", { name: "Finalize decision" })).toHaveCount(0);
  await curatorContext.close();
});
