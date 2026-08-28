import { describe, expect, it } from "vitest";

import {
  loadMarketMode,
  MARKET_MODE_COPY,
  MARKET_MODE_STORAGE_KEY,
  parseMarketMode,
  saveMarketMode,
} from "./mode";

describe("market mode preference", () => {
  it("defaults unknown values to Cloud Mode", () => {
    expect(parseMarketMode(undefined)).toBe("cloud");
    expect(parseMarketMode("legacy")).toBe("cloud");
    expect(MARKET_MODE_COPY.cloud.instrument).toContain("GC=F");
    expect(MARKET_MODE_COPY.xm.instrument).toContain("GOLD");
  });

  it("normalises xm to cloud when XM is paused", () => {
    // XM is currently paused per product decision.
    expect(MARKET_MODE_COPY.xm.paused).toBe(true);
    expect(parseMarketMode("xm")).toBe("cloud");
  });

  it("loads and saves only the selected mode key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(loadMarketMode(storage)).toBe("cloud");
    saveMarketMode(storage, "xm");
    expect(values.get(MARKET_MODE_STORAGE_KEY)).toBe("xm");
    // Stored "xm" is normalised to "cloud" because XM is paused.
    expect(loadMarketMode(storage)).toBe("cloud");
  });
});

