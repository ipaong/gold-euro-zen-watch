import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, analyze } from "./analysis";
import { evaluateSettlement } from "./settlement";
import { M15_MS, frozenMarketProvider } from "./market/frozen-provider";
import type { AnalysisResult, Prediction } from "./types";

function nextRandom(seed: number): number {
  return (seed * 1664525 + 1013904223) % 4294967296;
}

function asPrediction(result: AnalysisResult, asOf: number, horizon: number): Prediction {
  return {
    id: `random-${asOf}-${horizon}`,
    asOf,
    createdAt: asOf,
    mode: "time_machine",
    demo: true,
    symbol: "XAUEUR",
    timeframe: "M15",
    horizon,
    price: result.snapshot.price,
    models: result.models,
    ensemble: result.ensemble,
    consensus: result.consensus,
    scenarios: result.scenarios,
    forecast: result.forecast,
    plan: result.plan,
    narrative: result.narrative,
    newsRisk: result.news.riskLevel,
    newsSnapshot: result.news,
    goldBias: result.news.goldBias,
    eurBias: result.news.eurBias,
    actual: null,
    score: null,
    locked: true,
    ai: null,
  };
}

describe("seeded randomized workflows", () => {
  it("keeps no-look-ahead and forecast invariants across varied asOf/settings", () => {
    let seed = 20260827;
    const earliest = frozenMarketProvider.getEarliestTime();
    const latest = frozenMarketProvider.getLatestTime();
    const usableRange = latest - earliest - 260 * M15_MS;

    for (let i = 0; i < 24; i++) {
      seed = nextRandom(seed);
      const asOf = earliest + 220 * M15_MS + (seed % Math.max(M15_MS, usableRange));
      seed = nextRandom(seed);
      const horizon = 1 + (seed % 5);
      const result = analyze(asOf, { ...DEFAULT_SETTINGS, horizon });

      expect(result.snapshot.candles.every((candle) => candle.t <= asOf)).toBe(true);
      expect(result.news.recent.every((event) => event.time <= asOf && event.actual !== null)).toBe(
        true,
      );
      expect(
        result.news.upcoming.every((event) => event.time > asOf && event.actual === null),
      ).toBe(true);
      expect(result.models).toHaveLength(5);
      expect(new Set(result.models.map((model) => model.id)).size).toBe(5);
      expect(result.forecast).toHaveLength(horizon);
      expect(result.forecast.every((candle) => candle.t > asOf)).toBe(true);
      expect(result.forecast.every((candle) => candle.h >= candle.l)).toBe(true);
      expect(result.scenarios).toHaveLength(5);
      expect(result.scenarios.reduce((sum, scenario) => sum + scenario.weight, 0)).toBe(100);
      expect(result.consensus.direction).toBe(result.plan.direction);
    }
  });

  it("settles only a complete future horizon and remains idempotent after scoring", () => {
    let seed = 7;
    const earliest = frozenMarketProvider.getEarliestTime();
    for (let i = 0; i < 12; i++) {
      seed = nextRandom(seed);
      const asOf = earliest + (260 + (seed % 120)) * M15_MS;
      seed = nextRandom(seed);
      const horizon = 1 + (seed % 5);
      const result = analyze(asOf, { ...DEFAULT_SETTINGS, horizon });
      const prediction = asPrediction(result, asOf, horizon);
      const actual = frozenMarketProvider.getCandlesAfter(asOf, horizon);
      const evaluation = evaluateSettlement(prediction, frozenMarketProvider);

      expect(actual.every((candle) => candle.t > asOf)).toBe(true);
      expect(evaluation.status).toBe("ready");
      expect(evaluation.available).toBe(horizon);
      expect(evaluation.score?.candleDirTotal).toBe(horizon);
      expect(evaluation.score?.scoreVersion).toBe("1.0.0");

      const settled = { ...prediction, actual: evaluation.actual, score: evaluation.score };
      const second = evaluateSettlement(settled, frozenMarketProvider);
      expect(second.status).toBe("already_settled");
      expect(second.score).toEqual(evaluation.score);
    }
  });
});
