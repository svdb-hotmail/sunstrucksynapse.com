import { validatePaletteBackfillOptions } from "./artwork-palette-backfill.server";

export interface ArtworkPaletteDeploymentSteps {
  migrate(): Promise<void>;
  deployEncoder(): Promise<void>;
  buildApp(): Promise<void>;
  deployApp(): Promise<void>;
  enableProducer(): Promise<void>;
  runMetadataDryRun(arguments_: readonly string[]): Promise<void>;
}

/** Rejection stops the rollout before the next effect; producer activation follows both deploys. */
export async function deployArtworkPalettes(
  target: { environment: "development" | "production"; limit: number },
  steps: ArtworkPaletteDeploymentSteps,
): Promise<void> {
  validatePaletteBackfillOptions(target);
  await steps.migrate();
  await steps.deployEncoder();
  await steps.buildApp();
  await steps.deployApp();
  await steps.enableProducer();
  // This list is intentionally constructed here and never accepts backfill write flags.
  await steps.runMetadataDryRun([
    "--import",
    "tsx",
    "scripts/backfill-artwork-palettes.ts",
    "--environment",
    target.environment,
    "--limit",
    String(target.limit),
  ]);
}
