import { describe, expect, it } from "vitest";

import { benchmarkDirectionEngine } from "./direction-benchmark";
import { frozenYahooGoldProvider } from "./market/yahoo-frozen-provider";

describe("Direction Engine V3 walk-forward benchmark", () => {
  it("reports deterministic GC=F metrics without future leakage", () => {
    const result = benchmarkDirectionEngine(frozenYahooGoldProvider, 5);

    expect(result.sample).toBe(94);
    expect(result.engineDirectional + result.engineWaits).toBe(result.sample);
    expect(result).toMatchObject({
      engineDirectional: 10,
      engineHits: 9,
      engineAccuracy: 90,
      engineCoverage: 11,
      engineSevereOpposite: 0,
      engineSevereOppositeRate: 0,
      adaptiveDirectional: 32,
      adaptiveHits: 16,
      adaptiveAccuracy: 50,
      adaptiveCoverage: 34,
      baselineDirectional: 77,
      baselineHits: 34,
      baselineAccuracy: 44,
    });
    expect(result.engineAccuracy!).toBeGreaterThan(result.baselineAccuracy!);
    expect(result.adaptiveDirectional).toBeGreaterThan(0);
    expect(result.adaptiveDirectional).toBeLessThanOrEqual(result.sample);
    expect(result.adaptiveHits).toBeLessThanOrEqual(result.adaptiveDirectional);
  }, 15_000);
});
