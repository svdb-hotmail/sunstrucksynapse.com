import { afterEach, expect, it, vi } from "vitest";
import { hasActivePreparation, startCatalogueRefresh } from "../../app/services/catalogue-refresh";
import { catalogueTrackFixtures } from "../../app/features/curator-workspace/catalogue-fixtures";

afterEach(() => vi.useRealTimers());

it("refreshes active jobs even when another blocker classifies them as attention", () => {
  const track = { ...catalogueTrackFixtures[0], preparationStatus: "ready" };
  expect(hasActivePreparation([{ ...track, preparationStatus: "queued" }])).toBe(true);
  expect(hasActivePreparation([{ ...track, preparationStatus: "processing" }])).toBe(true);
  expect(hasActivePreparation([track])).toBe(false);
  expect(hasActivePreparation([])).toBe(false);
});

it("backs off, preserves its eight-request budget while hidden and stops after exhaustion", async () => {
  vi.useFakeTimers();
  let visible = false;
  const refresh = vi.fn(async () => {});
  const stop = startCatalogueRefresh(refresh, () => visible);
  await vi.advanceTimersByTimeAsync(120000);
  expect(refresh).not.toHaveBeenCalled();
  visible = true;
  await vi.advanceTimersByTimeAsync(5000);
  expect(refresh).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(9999);
  expect(refresh).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(refresh).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(600000);
  expect(refresh).toHaveBeenCalledTimes(8);
  expect(vi.getTimerCount()).toBe(0);
  stop();
});

it("waits for a slow refresh and cannot schedule after cleanup during a request", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const refresh = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const stop = startCatalogueRefresh(refresh, () => true);
  await vi.advanceTimersByTimeAsync(300000);
  expect(refresh).toHaveBeenCalledTimes(1);
  stop();
  finish();
  await vi.advanceTimersByTimeAsync(300000);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds retries after errors and cancels a pending timer on cleanup", async () => {
  vi.useFakeTimers();
  const refresh = vi.fn(async () => {
    throw new Error("unavailable");
  });
  const stop = startCatalogueRefresh(refresh, () => true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(refresh).toHaveBeenCalledTimes(1);
  stop();
  await vi.advanceTimersByTimeAsync(600000);
  expect(refresh).toHaveBeenCalledTimes(1);
});
