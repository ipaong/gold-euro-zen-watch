import { describe, expect, it } from "vitest";

import { frozenMarketProvider } from "../market/frozen-provider";
import { buildSnapshot } from "../snapshot";
import { runForecast } from "./engine";

describe("runForecast", () => {
  it("is deterministic for a frozen snapshot and produces a five-candle distribution", () => {
    const asOf = frozenMarketProvider.getLatestTime() - 24 * 60 * 60 * 1000;
    const snapshot = buildSnapshot(frozenMarketProvider, asOf);
    const first = runForecast(snapshot);
    const second = runForecast(snapshot);

    expect(second).toEqual(first);
    expect(first.forecast).toHaveLength(5);
    expect(first.scenarios).toHaveLength(5);
    expect(first.scenarios.reduce((sum, scenario) => sum + scenario.weight, 0)).toBe(100);
    expect(first.forecast.every((item) => item.t > snapshot.lastCandleTime)).toBe(true);
  });
});
