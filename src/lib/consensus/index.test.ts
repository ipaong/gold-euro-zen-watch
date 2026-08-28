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
    symbol: "GC=F",
    timeframe: "15m",
    intervalMs: 15 * 60 * 1000,
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

  it("keeps a valid 3-of-5 setup directional when confidence is moderate", () => {
    const moderateVotes = votes(["BUY", "BUY", "BUY", "WAIT", "WAIT"]).map((vote) => ({
      ...vote,
      confidence: 65,
    }));
    const result = buildConsensus(market(), news(), moderateVotes, settings, 1);

    expect(result.direction).toBe("BUY");
    expect(result.confidence).toBeGreaterThanOrEqual(settings.confidenceThreshold);
    expect(result.checks.find((check) => check.id === "confidence")?.pass).toBe(true);
  });

  it("keeps a bold call while exposing high-impact news as a warning", () => {
    const result = buildConsensus(
      market(),
      news({ minutesToHighImpact: 10, riskLevel: "high" }),
      votes(["BUY", "BUY", "BUY", "WAIT", "WAIT"]),
      settings,
      1,
    );

    expect(result.rawDirection).toBe("BUY");
    expect(result.direction).toBe("BUY");
    expect(result.blocked).toBe(false);
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

  it("keeps a bold call while flagging weak independence as a warning", () => {
    const result = buildConsensus(
      market(),
      news(),
      votes(["BUY", "BUY", "WAIT", "WAIT", "BUY"]),
      settings,
      1,
    );

    expect(result.rawDirection).toBe("BUY");
    expect(result.direction).toBe("BUY");
    expect(result.blocked).toBe(false);
    expect(result.checks.find((check) => check.id === "agreement")?.pass).toBe(false);
    expect(result.checks.find((check) => check.id === "agreement")?.detail).toContain(
      "กลุ่มราคาที่สัมพันธ์กัน",
    );
  });

  it("keeps a bold BUY while exposing opposing entry context as a warning", () => {
    const fallingCandles = [3015, 3010, 3005, 3000].map((close, index) => ({
      t: index,
      o: close + 1,
      h: close + 2,
      l: close - 1,
      c: close,
    }));
    const result = buildConsensus(
      market({ candles: fallingCandles, momentumScore: -0.8 }),
      news(),
      votes(["BUY", "BUY", "BUY", "WAIT", "WAIT"]),
      settings,
      1,
    );

    expect(result.rawDirection).toBe("BUY");
    expect(result.direction).toBe("BUY");
    expect(result.blocked).toBe(false);
    expect(result.checks.find((check) => check.id === "entry_context")?.pass).toBe(false);
  });

  it("does not flip a bold BUY into SELL", () => {
    const result = buildConsensus(
      market({ momentumScore: -0.8 }),
      news(),
      votes(["BUY", "BUY", "BUY", "WAIT", "WAIT"]),
      settings,
      1,
    );

    expect(result.rawDirection).toBe("BUY");
    expect(result.direction).toBe("BUY");
    expect(result.blocked).toBe(false);
  });
});
