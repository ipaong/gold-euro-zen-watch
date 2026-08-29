import { describe, expect, it } from "vitest";

import { runDirectionEngine } from "./direction-engine";
import type { Candle, MarketSnapshot, NewsSnapshot } from "./types";

const interval = 15 * 60 * 1000;

function candle(t: number, close: number, open = close): Candle {
  return { t, o: open, h: Math.max(open, close) + 0.3, l: Math.min(open, close) - 0.3, c: close };
}

function neutralNews(asOf: number): NewsSnapshot {
  return {
    asOf,
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
  };
}

function downtrendSnapshot(): MarketSnapshot {
  const closes = [
    100, 99.8, 99.4, 98.9, 98.3, 97.8, 97.2, 96.7, 96.1, 95.7, 95.1, 94.6, 94.1, 93.7,
  ];
  const asOf = (closes.length - 1) * interval;
  const candles = closes.map((close, index) =>
    candle(index * interval, close, index === closes.length - 1 ? close - 0.2 : close + 0.15),
  );
  return {
    asOf,
    symbol: "GC=F",
    timeframe: "15m",
    intervalMs: interval,
    price: 93.7,
    prevClose: 94.1,
    changePct: -0.43,
    candles,
    lastCandleTime: asOf,
    ema20: 96,
    ema50: 99,
    ema200: 104,
    ema20Slope: -1.1,
    ema50Slope: -0.8,
    rsi14: 35,
    macdLine: -1,
    macdSignal: -0.6,
    macdHist: -0.35,
    macdHistPrev: -0.45,
    atr14: 1,
    atrPct: 1,
    atrRatio: 1,
    support: 93.4,
    resistance: 96,
    swingHigh: 100.3,
    swingLow: 93.4,
    higherHighs: false,
    lowerLows: true,
    consecutiveBull: 1,
    consecutiveBear: 0,
    bodyStrength: 0.55,
    zScore: -1.7,
    trendScore: -1,
    momentumScore: -0.55,
    regime: "trending_down",
  };
}

describe("Direction Engine V3", () => {
  it("continues a strong downtrend despite oversold/support proximity and one green candle", () => {
    const snapshot = downtrendSnapshot();
    const result = runDirectionEngine(snapshot, neutralNews(snapshot.asOf));

    expect(result.direction).toBe("SELL");
    expect(result.continuationScore).toBeLessThan(-0.5);
    expect(result.alignedEvidence).toBeGreaterThanOrEqual(4);
    expect(result.reversalConfirmed).toBe(false);
  });

  it("requires structure and momentum confirmation before calling a reversal", () => {
    const snapshot = downtrendSnapshot();
    snapshot.candles = [...snapshot.candles.slice(0, -1), candle(snapshot.asOf, 94, 93.6)];
    snapshot.price = 94;
    snapshot.prevClose = 94.1;

    const result = runDirectionEngine(snapshot, neutralNews(snapshot.asOf));

    expect(result.reversalConfirmed).toBe(false);
    expect(result.direction).not.toBe("BUY");
  });

  it("uses WAIT instead of chasing an exhausted trend or flipping against it", () => {
    const snapshot = downtrendSnapshot();
    snapshot.zScore = -2.3;
    snapshot.rsi14 = 28;

    const result = runDirectionEngine(snapshot, neutralNews(snapshot.asOf));

    expect(result.tapeDirection).toBe("SELL");
    expect(result.exhaustionVeto).toBe(true);
    expect(result.direction).toBe("WAIT");
  });

  it("allows a reversal only after price breaks structure and momentum turns", () => {
    const snapshot = downtrendSnapshot();
    snapshot.candles = [...snapshot.candles.slice(0, -1), candle(snapshot.asOf, 96, 93.5)];
    snapshot.price = 96;
    snapshot.prevClose = 94.1;
    snapshot.support = 95.5;
    snapshot.rsi14 = 38;
    snapshot.zScore = -1.6;
    snapshot.macdHist = -0.05;
    snapshot.macdHistPrev = -0.4;
    snapshot.momentumScore = 0.35;

    const result = runDirectionEngine(snapshot, neutralNews(snapshot.asOf));

    expect(result.reversalConfirmed).toBe(true);
    expect(result.reversalDirection).toBe("BUY");
    expect(result.direction).toBe("BUY");
  });

  it("ignores candles after asOf", () => {
    const snapshot = downtrendSnapshot();
    const before = runDirectionEngine(snapshot, neutralNews(snapshot.asOf));
    snapshot.candles = [
      ...snapshot.candles,
      candle(snapshot.asOf + interval, 120),
      candle(snapshot.asOf + interval * 2, 130),
    ];

    const after = runDirectionEngine(snapshot, neutralNews(snapshot.asOf));
    expect(after).toEqual(before);
  });
});
