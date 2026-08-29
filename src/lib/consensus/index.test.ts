import { describe, expect, it } from "vitest";

import type { AppSettings, MarketSnapshot, ModelId, ModelVote, NewsSnapshot } from "../types";
import { buildConsensus } from "./index";

const settings: AppSettings = {
  confidenceThreshold: 60,
  minAgreement: 3,
  newsAvoidMinutes: 30,
  horizon: 5,
};

const ids: ModelId[] = ["trend", "momentum", "technical", "news", "volatility"];

function candles(closes: number[]) {
  return closes.map((close, index) => ({
    t: index,
    o: close + 0.1,
    h: close + 0.3,
    l: close - 0.3,
    c: close,
  }));
}

function market(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  const series = candles([106, 105.5, 105, 104.2, 103.6, 103, 102.3, 101.7, 101, 100.3, 99.7, 99]);
  return {
    asOf: series[series.length - 1]!.t,
    symbol: "GC=F",
    timeframe: "15m",
    intervalMs: 15 * 60 * 1000,
    price: 99,
    prevClose: 99.7,
    changePct: -0.7,
    candles: series,
    lastCandleTime: series[series.length - 1]!.t,
    ema20: 101,
    ema50: 104,
    ema200: 110,
    ema20Slope: -1,
    ema50Slope: -0.7,
    rsi14: 35,
    macdLine: -1,
    macdSignal: -0.5,
    macdHist: -0.5,
    macdHistPrev: -0.4,
    atr14: 1,
    atrPct: 1,
    atrRatio: 1,
    support: 98,
    resistance: 102,
    swingHigh: 106,
    swingLow: 98,
    higherHighs: false,
    lowerLows: true,
    consecutiveBull: 0,
    consecutiveBear: 5,
    bodyStrength: 0.6,
    zScore: -1.4,
    trendScore: -0.9,
    momentumScore: -0.7,
    regime: "trending_down",
    ...overrides,
  };
}

function news(overrides: Partial<NewsSnapshot> = {}): NewsSnapshot {
  return {
    asOf: 0,
    available: true,
    demo: true,
    headlines: [],
    goldBias: "neutral",
    eurBias: "neutral",
    netBias: "WAIT",
    netStrength: 0,
    upcoming: [],
    recent: [],
    minutesToHighImpact: null,
    nextHighImpact: null,
    riskLevel: "low",
    ...overrides,
  };
}

function votes(directions: ModelVote["direction"][]): ModelVote[] {
  return directions.map((direction, index) => ({
    id: ids[index]!,
    name: ids[index]!,
    direction,
    confidence: 75,
    summary: "test",
    factors: [],
    risks: [],
    unavailable: false,
  }));
}

describe("Direction Engine V3 quality gate", () => {
  it("follows a strong downtrend even when four supporting models say WAIT", () => {
    const result = buildConsensus(
      market(),
      news(),
      votes(["SELL", "WAIT", "WAIT", "WAIT", "WAIT"]),
      settings,
      0.8,
    );

    expect(result.rawDirection).toBe("SELL");
    expect(result.direction).toBe("SELL");
    expect(result.engine?.alignedEvidence).toBeGreaterThanOrEqual(4);
    expect(result.agree).toBe(1);
  });

  it("does not let correlated model votes override visible bearish tape", () => {
    const result = buildConsensus(
      market(),
      news(),
      votes(["BUY", "BUY", "BUY", "BUY", "WAIT"]),
      settings,
      0.8,
    );

    expect(result.rawDirection).toBe("SELL");
    expect(result.direction).toBe("SELL");
  });

  it("hard-blocks a supplied call that is severely opposite to price", () => {
    const result = buildConsensus(
      market(),
      news(),
      votes(["BUY", "BUY", "BUY", "WAIT", "WAIT"]),
      settings,
      1,
      undefined,
      {
        version: "3.0.0",
        direction: "BUY",
        confidence: 90,
        score: 0.8,
        continuationScore: 0.8,
        shortTapeScore: -0.9,
        swingTapeScore: -0.8,
        movesAtr: { one: -1, three: -2, five: -3, twelve: -4 },
        alignedEvidence: 4,
        reversalConfirmed: false,
        reversalDirection: "WAIT",
        severeOpposition: true,
        tapeDirection: "BUY",
        patternAligned: false,
        adaptiveAligned: false,
        multiHorizonAligned: false,
        exhaustionVeto: false,
        pattern: {
          direction: "WAIT",
          rawDirection: "WAIT",
          edge: 0,
          neighborCount: 0,
          calibrationSample: 0,
          directHits: 0,
          inverseHits: 0,
          inverted: false,
          calibrated: false,
        },
        adaptive: {
          version: "3.0.0",
          direction: "WAIT",
          probabilityUp: 0.5,
          edge: 0,
          confidence: 50,
          regime: "ranging",
          calibrated: false,
          sampleCount: 0,
          directionalSample: 0,
          directionalHits: 0,
          accuracy: null,
          coverage: null,
          lastLearnedOutcomeTime: null,
          experts: {
            tape: {
              probabilityUp: 0.5,
              weight: 0.2,
              inverted: false,
              globalSamples: 0,
              regimeSamples: 0,
              posteriorAccuracy: 0.5,
            },
            trend: {
              probabilityUp: 0.5,
              weight: 0.2,
              inverted: false,
              globalSamples: 0,
              regimeSamples: 0,
              posteriorAccuracy: 0.5,
            },
            mean_reversion: {
              probabilityUp: 0.5,
              weight: 0.2,
              inverted: false,
              globalSamples: 0,
              regimeSamples: 0,
              posteriorAccuracy: 0.5,
            },
            breakout: {
              probabilityUp: 0.5,
              weight: 0.2,
              inverted: false,
              globalSamples: 0,
              regimeSamples: 0,
              posteriorAccuracy: 0.5,
            },
            analog: {
              probabilityUp: 0.5,
              weight: 0.2,
              inverted: false,
              globalSamples: 0,
              regimeSamples: 0,
              posteriorAccuracy: 0.5,
            },
          },
          analog: { neighborCount: 0, effectiveSamples: 0 },
          projection: [],
        },
        reasons: ["test contradiction"],
      },
    );

    expect(result.direction).toBe("WAIT");
    expect(result.checks.find((check) => check.id === "entry_context")?.pass).toBe(false);
  });

  it("treats nearby high-impact news as a warning without flipping direction", () => {
    const result = buildConsensus(
      market(),
      news({ minutesToHighImpact: 10, riskLevel: "high" }),
      votes(["SELL", "SELL", "WAIT", "WAIT", "WAIT"]),
      settings,
      0.8,
    );

    expect(result.direction).toBe("SELL");
    expect(result.checks.find((check) => check.id === "news")?.pass).toBe(false);
  });

  it("returns WAIT when multiple tape horizons have no edge", () => {
    const flat = candles([100, 100.1, 99.9, 100.1, 100, 100.1, 99.9, 100, 100.1, 100, 100.05, 100]);
    const result = buildConsensus(
      market({
        asOf: flat[flat.length - 1]!.t,
        candles: flat,
        price: 100,
        prevClose: 100.05,
        ema20: 100,
        ema50: 100,
        ema200: 100,
        ema20Slope: 0,
        ema50Slope: 0,
        trendScore: 0,
        momentumScore: 0,
        higherHighs: false,
        lowerLows: false,
        regime: "ranging",
      }),
      news(),
      votes(["WAIT", "WAIT", "WAIT", "WAIT", "WAIT"]),
      settings,
      0.5,
    );

    expect(result.rawDirection).toBe("WAIT");
    expect(result.direction).toBe("WAIT");
  });
});
