import { describe, expect, it } from "vitest";

import { frozenYahooGoldProvider } from "./market/yahoo-frozen-provider";
import { createFeedMarketProvider } from "./market/feed-provider";
import { evaluateSettlement } from "./settlement";
import type { MarketDataFeed } from "./market/contract";
import type { Candle, Prediction } from "./types";

const INTERVAL_MS = 15 * 60 * 1000;

function createDummyPrediction(asOf: number, horizon = 5): Prediction {
  const forecast: Candle[] = Array.from({ length: horizon }).map((_, i) => ({
    t: asOf + (i + 1) * INTERVAL_MS,
    o: 2600 + i,
    h: 2605 + i,
    l: 2595 + i,
    c: 2602 + i,
  }));

  return {
    id: "pred-test-reveal",
    asOf,
    createdAt: asOf,
    mode: "time_machine",
    demo: false,
    symbol: "GC=F",
    timeframe: "15m",
    provider: "yahoo",
    providerSymbol: "GC=F",
    dataStatus: "delayed",
    horizon,
    price: 2600,
    models: [],
    ensemble: {} as never,
    consensus: {
      direction: "BUY",
      rawDirection: "BUY",
      agree: 4,
      total: 5,
      confidence: 80,
      buyVotes: 4,
      sellVotes: 0,
      waitVotes: 1,
      checks: [],
      blocked: false,
      reason: "test",
    },
    scenarios: [],
    forecast,
    plan: {
      direction: "BUY",
      price: 2600,
      support: 2590,
      resistance: 2620,
      invalidation: 2585,
      atr: 5,
      risk: "low",
    },
    narrative: {} as never,
    newsRisk: "low",
    goldBias: "bullish",
    eurBias: "neutral",
    actual: null,
    score: null,
    locked: true,
  };
}

describe("Cloud Settlement & Inline Reveal", () => {
  it("evaluates settlement successfully using frozenYahooGoldProvider when candles exist after asOf", () => {
    // Pick an asOf time that has at least 5 candles after it in the frozen dataset
    const latest = frozenYahooGoldProvider.getLatestTime();
    const asOf = latest - 10 * INTERVAL_MS;

    const pred = createDummyPrediction(asOf, 5);
    const evaluation = evaluateSettlement(pred, frozenYahooGoldProvider);

    expect(evaluation.status).toBe("ready");
    expect(evaluation.actual).toHaveLength(5);
    expect(evaluation.score).not.toBeNull();
    // All actual candles must be strictly after asOf
    for (const candle of evaluation.actual) {
      expect(candle.t).toBeGreaterThan(asOf);
    }
  });

  it("returns not_ready when asOf is the latest candle (no future candles available)", () => {
    const latest = frozenYahooGoldProvider.getLatestTime();
    const pred = createDummyPrediction(latest, 5);
    const evaluation = evaluateSettlement(pred, frozenYahooGoldProvider);

    expect(evaluation.status).toBe("not_ready");
    expect(evaluation.actual).toHaveLength(0);
    expect(evaluation.available).toBe(0);
    expect(evaluation.score).toBeNull();
  });

  it("evaluates settlement using live feed via createFeedMarketProvider", () => {
    const baseTime = Date.parse("2026-08-28T00:00:00Z");
    const candles: Candle[] = Array.from({ length: 250 }).map((_, i) => ({
      t: baseTime + i * INTERVAL_MS,
      o: 2650 + (i % 5),
      h: 2655 + (i % 5),
      l: 2645 + (i % 5),
      c: 2652 + (i % 5),
    }));

    const feed: MarketDataFeed = {
      source: "yahoo",
      sourceType: "live",
      displayName: "Gold Futures (Yahoo)",
      symbol: "GC=F",
      providerSymbol: "GC=F",
      timeframe: "15m",
      intervalMs: INTERVAL_MS,
      delayed: true,
      demo: false,
      fetchedAt: baseTime + 250 * INTERVAL_MS,
      candles: candles.map((c) => ({ ...c, closed: true, sourceSymbol: "GC=F" })),
    };

    const provider = createFeedMarketProvider(feed);

    // Pick asOf at index 240, so 10 candles exist after asOf
    const asOf = candles[240]!.t;
    const pred = createDummyPrediction(asOf, 5);

    const evaluation = evaluateSettlement(pred, provider);
    expect(evaluation.status).toBe("ready");
    expect(evaluation.actual).toHaveLength(5);
    expect(evaluation.score).not.toBeNull();
    expect(evaluation.score?.directionCorrect).not.toBeUndefined();
    expect(evaluation.score?.mae).toBeGreaterThan(0);
  });
});
