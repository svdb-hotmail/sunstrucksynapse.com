import { describe, expect, it, vi } from "vitest";
import {
  deployArtworkPalettes,
  type ArtworkPaletteDeploymentSteps,
} from "../../app/services/artwork-palette-deployment.server";

const order = [
  "migrate",
  "deployEncoder",
  "buildApp",
  "deployApp",
  "enableProducer",
  "runMetadataDryRun",
] as const;
function fixture(failAt?: keyof ArtworkPaletteDeploymentSteps) {
  const calls: string[] = [];
  const step = (name: keyof ArtworkPaletteDeploymentSteps) =>
    vi.fn(async () => {
      calls.push(name);
      if (name === failAt) throw new Error(`Failed ${name}`);
    });
  const steps = {
    migrate: step("migrate"),
    deployEncoder: step("deployEncoder"),
    buildApp: step("buildApp"),
    deployApp: step("deployApp"),
    enableProducer: step("enableProducer"),
    runMetadataDryRun: vi.fn(async (_arguments: readonly string[]) => {
      calls.push("runMetadataDryRun");
    }),
  };
  return { calls, steps };
}

describe("artwork palette deployment ordering", () => {
  it("stops all deployment effects when migration fails", async () => {
    const { calls, steps } = fixture("migrate");
    await expect(
      deployArtworkPalettes({ environment: "production", limit: 100 }, steps),
    ).rejects.toThrow("Failed migrate");
    expect(calls).toEqual(["migrate"]);
    expect(steps.enableProducer).not.toHaveBeenCalled();
    expect(steps.runMetadataDryRun).not.toHaveBeenCalled();
  });

  it.each(["deployEncoder", "buildApp", "deployApp"] as const)(
    "never activates the producer after %s fails",
    async (failAt) => {
      const { calls, steps } = fixture(failAt);
      await expect(
        deployArtworkPalettes({ environment: "development", limit: 10 }, steps),
      ).rejects.toThrow(`Failed ${failAt}`);
      expect(calls).toEqual(order.slice(0, order.indexOf(failAt) + 1));
      expect(steps.enableProducer).not.toHaveBeenCalled();
      expect(steps.runMetadataDryRun).not.toHaveBeenCalled();
    },
  );

  it("deploys in order and automatically invokes metadata-only backfill arguments", async () => {
    const { calls, steps } = fixture();
    await deployArtworkPalettes({ environment: "production", limit: 100 }, steps);
    expect(calls).toEqual(order);
    expect(steps.runMetadataDryRun).toHaveBeenCalledExactlyOnceWith([
      "--import",
      "tsx",
      "scripts/backfill-artwork-palettes.ts",
      "--environment",
      "production",
      "--limit",
      "100",
    ]);
    const automaticArguments = steps.runMetadataDryRun.mock.calls[0][0];
    expect(automaticArguments).not.toContain("--write");
    expect(automaticArguments).not.toContain("--confirm-production-writes");
    expect(automaticArguments).not.toContain("--requeue-failed");
  });

  it("does not start effects for an invalid bounded target", async () => {
    const { calls, steps } = fixture();
    await expect(
      deployArtworkPalettes({ environment: "production", limit: Infinity }, steps),
    ).rejects.toThrow("Limit");
    expect(calls).toEqual([]);
  });
});
