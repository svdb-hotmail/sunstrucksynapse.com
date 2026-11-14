import { describe, expect, it } from "vitest";
import {
  chooseSkin,
  DEFAULT_SKIN,
  isSkin,
  SKIN_INIT_SCRIPT,
  SKIN_STORAGE_KEY,
} from "../../app/design-system/skin";

describe("visitor skin", () => {
  it("reuses a valid saved choice and chooses one of three skins otherwise", () => {
    expect(chooseSkin("synth", 0)).toBe("synth");
    expect(chooseSkin(null, 0)).toBe("editorial");
    expect(chooseSkin(null, 0.5)).toBe("underground");
    expect(chooseSkin(null, 0.99)).toBe("synth");
    expect(chooseSkin("unknown", 0)).toBe(DEFAULT_SKIN);
    expect(isSkin("unknown")).toBe(false);
  });

  it("initializes and persists the skin before the app loads", () => {
    const values = new Map<string, string>();
    const document = { documentElement: { dataset: {} as Record<string, string> } };
    const window = {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    };
    const run = new Function("window", "document", "Math", SKIN_INIT_SCRIPT);
    run(window, document, { random: () => 0.9, floor: Math.floor });
    expect(document.documentElement.dataset.skin).toBe("synth");
    expect(values.get(SKIN_STORAGE_KEY)).toBe("synth");
    run(window, document, { random: () => 0, floor: Math.floor });
    expect(document.documentElement.dataset.skin).toBe("synth");
  });
});
