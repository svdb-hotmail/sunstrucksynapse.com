import { expect, test } from "@playwright/test";

test("submits an invited draft and lets a curator review it through acceptance without auto-publishing", async ({
  browser,
  page,
}) => {
  await page.goto("/submit/phase3-invite-token");
  await page.getByLabel("Work title").fill("Playwright Orbit");
  await page.getByLabel("Artist biography").fill("Playwright artist biography.");
  await page.getByLabel("Release title").fill("Playwright Orbit EP");
  await page.getByLabel("Track title").fill("Playwright Orbit");
  await page.getByLabel("Entitlement statement").fill("I control the rights needed for review.");
  await page.getByLabel("Public rights summary").fill("Original work controlled by the submitter.");
  await page
    .getByLabel("Submission attestation")
    .fill("I attest that the declaration is accurate.");
  await page
    .getByLabel("AI use description")
    .fill("AI-assisted ideation informed the arrangement.");
  await page
    .getByLabel("Meaningful human contribution")
    .fill("Human composition, editing, and final production.");
  await page
    .getByLabel("Public process summary")
    .fill("AI supported ideation while the artist finished the work.");
  await page
    .getByRole("textbox", { name: "Summary", exact: true })
    .fill("The artist rebuilt the track from sketches.");
  await page.getByLabel("Territories (comma separated)").fill("Worldwide");
  await page.getByLabel("Tools and systems (comma separated)").fill("Sketcher");
  await page.locator('[name="process.humanRoles.0.name"]').fill("Invited Artist");
  await page.locator('[name="process.humanRoles.0.role"]').fill("artist");
  await page
    .locator('[name="process.humanRoles.0.contribution"]')
    .fill("Composition and production");
  await page.locator('[name="process.aiTools.0.name"]').fill("Sketcher");
  await page.locator('[name="process.aiTools.0.model"]').fill("v2");
  await page.locator('[name="process.aiTools.0.provider"]').fill("Example");
  await page.locator('[name="process.aiTools.0.purpose"]').fill("Ideation");
  await page.locator('[name="provenance.steps.0.processType"]').fill("arrangement");
  await page
    .locator('[name="provenance.steps.0.description"]')
    .fill("The artist rebuilt the arrangement from sketches.");
  await page.locator('[name="provenance.sources.0.reference"]').fill("Sketch-001");
  for (const checkbox of await page.locator('input[type="checkbox"][name^="ack."]').all()) {
    await checkbox.check();
  }
  await page.getByRole("button", { name: "Submit for review" }).click();

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
  await submissionCard.getByRole("button", { name: "Assign me" }).click();
  await submissionCard.getByRole("button", { name: "Move to eligibility review" }).click();
  await submissionCard.getByRole("button", { name: "Move to listening" }).click();
  await submissionCard.getByRole("button", { name: "Accept" }).click();

  await expect(submissionCard).toContainText("accepted");
  await curatorContext.close();
});
