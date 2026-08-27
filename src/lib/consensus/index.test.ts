import { describe, expect, it } from "vitest";

import type { AppSettings, MarketSnapshot, ModelId, ModelVote, NewsSnapshot } from "../types";
import { buildConsensus } from "./index";

const settings: AppSettings = {
  confidenceThreshold: 60,
  minAgreement: 3,
  newsAvoidMinutes: 30,
  horizon: 5,
};

function market(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    asOf: 0,
    price: 3000,
    prevClose: 2999,
    changePct: 0,
    candles: [],
    lastCandleTime: 0,
    ema20: 3000,
    ema50: 2990,
    ema200: 2950,
    ema20Slope: 1,
    ema50Slope: 1,
    rsi14: 55,
    macdLine: 1,
    macdSignal: 0.5,
    macdHist: 0.5,
    macdHistPrev: 0.4,
    atr14: 5,
    atrPct: 0.2,
    atrRatio: 1,
    support: 2980,
    resistance: 3020,
    swingHigh: 3010,
    swingLow: 2990,
    higherHighs: true,
    lowerLows: false,
    consecutiveBull: 2,
    consecutiveBear: 0,
    bodyStrength: 0.6,
    zScore: 0.5,
    trendScore: 0.7,
    momentumScore: 0.6,
    regime: "trending_up",
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

const ids: ModelId[] = ["trend", "momentum", "technical", "news", "volatility"];

function votes(directions: ModelVote["direction"][]): ModelVote[] {
  return directions.map((direction, index) => ({
    id: ids[index]!,
    name: ids[index]!,
    direction,
    confidence: 90,
    summary: "test",
    factors: [],
    risks: [],
    unavailable: false,
  }));
}

describe("buildConsensus quality gate", () => {
  it("allows BUY only when agreement and every safety check pass", () => {
    const result = buildConsensus(
      market(),
      news(),
      votes(["BUY", "BUY", "BUY", "WAIT", "WAIT"]),
      settings,
      1,
    );

    expect(result.direction).toBe("BUY");
    expect(result.blocked).toBe(false);
    expect(result.checks.every((check) => check.pass)).toBe(true);
  });

  it("forces WAIT when high-impact news is inside the avoidance window", () => {
    const result = buildConsensus(
      market(),
      news({ minutesToHighImpact: 10, riskLevel: "high" }),
      votes(["BUY", "BUY", "BUY", "WAIT", "WAIT"]),
      settings,
      1,
    );

    expect(result.rawDirection).toBe("BUY");
    expect(result.direction).toBe("WAIT");
    expect(result.checks.find((check) => check.id === "news")?.pass).toBe(false);
  });

  it("does not convert a split vote into a trade signal", () => {
    const result = buildConsensus(
      market(),
      news(),
      votes(["BUY", "BUY", "SELL", "SELL", "WAIT"]),
      settings,
      1,
    );

    expect(result.rawDirection).toBe("WAIT");
    expect(result.direction).toBe("WAIT");
    expect(result.blocked).toBe(true);
  });
});
