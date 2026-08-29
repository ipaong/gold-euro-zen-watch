import { describe, expect, it } from "vitest";

import { runAdaptiveReplay } from "./adaptive-replay";
import { frozenYahooGoldProvider } from "./market/yahoo-frozen-provider";
import type { Candle } from "./types";

const INTERVAL = 15 * 60 * 1000;

function futureShock(start: number, price: number): Candle[] {
  return Array.from({ length: 8 }, (_, index) => {
    const close = price + (index + 1) * 100;
    return {
      t: start + (index + 1) * INTERVAL,
      o: close - 20,
      h: close + 10,
      l: close - 30,
      c: close,
    };
  });
}

function syntheticTrend(length = 180): Candle[] {
  let close = 100;
  return Array.from({ length }, (_, index) => {
    const wave = Math.sin(index / 5) * 0.12;
    const open = close;
    close = open + 0.22 + wave;
    return {
      t: index * INTERVAL,
      o: open,
      h: Math.max(open, close) + 0.12,
      l: Math.min(open, close) - 0.12,
      c: close,
    };
  });
}

describe("Direction Engine V3 adaptive historical replay", () => {
  it("replays chronologically and returns auditable online weights", () => {
    const asOf = frozenYahooGoldProvider.getLatestTime();
    const candles = frozenYahooGoldProvider.getCandlesUpTo(asOf);
    const result = runAdaptiveReplay(candles, { asOf, horizon: 5 });
    const weightTotal = Object.values(result.experts).reduce(
      (sum, expert) => sum + expert.weight,
      0,
    );

    expect(result.version).toBe("3.0.0");
    expect(result.sampleCount).toBeGreaterThan(100);
    expect(result.calibrated).toBe(true);
    expect(weightTotal).toBeCloseTo(1, 3);
    expect(result.analog.neighborCount).toBe(15);
    expect(result.projection).toHaveLength(5);
    expect(result.lastLearnedOutcomeTime).not.toBeNull();
    expect(result.lastLearnedOutcomeTime!).toBeLessThanOrEqual(asOf);
  });

  it("cannot see appended candles after the simulated asOf", () => {
    const asOf = frozenYahooGoldProvider.getLatestTime() - 12 * INTERVAL;
    const visible = frozenYahooGoldProvider.getCandlesUpTo(asOf);
    const price = visible[visible.length - 1]!.c;
    const before = runAdaptiveReplay(visible, { asOf, horizon: 5 });
    const after = runAdaptiveReplay([...visible, ...futureShock(asOf, price)], {
      asOf,
      horizon: 5,
    });

    expect(after).toEqual(before);
  });

  it("reveals feedback only after the full horizon has matured", () => {
    const candles = syntheticTrend(120);
    const result = runAdaptiveReplay(candles, {
      asOf: candles[candles.length - 1]!.t,
      horizon: 5,
      minFeatureIndex: 60,
    });

    // Predictions at anchors 60..114 have matured. Anchors 115..119 remain
    // locked and cannot influence the current weights yet.
    expect(result.sampleCount).toBe(55);
    expect(result.lastLearnedOutcomeTime).toBe(candles[119]!.t);
  });

  it("adapts expert weights after repeated walk-forward outcomes", () => {
    const candles = syntheticTrend();
    const result = runAdaptiveReplay(candles, {
      asOf: candles[candles.length - 1]!.t,
      horizon: 5,
    });
    const weights = Object.values(result.experts).map((expert) => expert.weight);

    expect(result.direction).toBe("BUY");
    expect(Math.max(...weights) - Math.min(...weights)).toBeGreaterThan(0.01);
    expect(result.experts.mean_reversion.weight).toBeLessThan(result.experts.trend.weight);
  });
});
