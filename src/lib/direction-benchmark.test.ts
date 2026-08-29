import { describe, expect, it } from "vitest";

import { benchmarkDirectionEngine } from "./direction-benchmark";
import { frozenYahooGoldProvider } from "./market/yahoo-frozen-provider";

describe("Direction Engine V2 walk-forward benchmark", () => {
  it("reports deterministic GC=F metrics without future leakage", () => {
    const result = benchmarkDirectionEngine(frozenYahooGoldProvider, 5);

    expect(result.sample).toBe(94);
    expect(result.engineDirectional + result.engineWaits).toBe(result.sample);
    expect(result).toMatchObject({
      engineDirectional: 12,
      engineHits: 10,
      engineAccuracy: 83,
      engineCoverage: 13,
      engineSevereOpposite: 0,
      engineSevereOppositeRate: 0,
      baselineDirectional: 77,
      baselineHits: 34,
      baselineAccuracy: 44,
    });
    expect(result.engineAccuracy!).toBeGreaterThan(result.baselineAccuracy!);
  });
});
