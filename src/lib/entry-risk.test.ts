import { describe, expect, it } from "vitest";

import { assessEntryRisk } from "./entry-risk";
import type { Candle, MarketSnapshot } from "./types";

function candle(t: number, close: number): Candle {
  return { t, o: close, h: close + 0.5, l: close - 0.5, c: close };
}

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    candles: [100, 100.2, 100.4, 100.6].map((close, index) => candle(index, close)),
    price: 100.6,
    atr14: 1,
    support: 97,
    resistance: 104,
    zScore: 0.3,
    rsi14: 55,
    macdHist: 0.2,
    macdHistPrev: 0.1,
    momentumScore: 0.4,
    ...overrides,
  } as MarketSnapshot;
}

describe("entry risk guard", () => {
  it("does not block an aligned directional setup", () => {
    expect(assessEntryRisk(snapshot(), "BUY").blocked).toBe(false);
  });

  it("blocks a signal when recent price and momentum strongly oppose it", () => {
    const result = assessEntryRisk(
      snapshot({
        candles: [103, 102, 101, 100].map((close, index) => candle(index, close)),
        price: 100,
        momentumScore: -0.7,
      }),
      "BUY",
    );

    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain("3 แท่งล่าสุดเคลื่อนสวนสัญญาณแรง");
    expect(result.reasons).toContain("Momentum หลักสวนทิศเสียงข้างมาก");
  });

  it("does not treat support proximity alone as a confirmed bullish reversal", () => {
    const result = assessEntryRisk(
      snapshot({
        candles: [103, 102, 101, 100].map((close, index) => candle(index, close)),
        price: 100,
        support: 99.8,
        zScore: -2,
        rsi14: 28,
        momentumScore: -0.7,
      }),
      "SELL",
    );

    expect(result.opposingReversal).toBeGreaterThan(0.3);
    expect(result.blocked).toBe(false);
  });

  it("never invents a direction when the vote is WAIT", () => {
    expect(assessEntryRisk(snapshot({ momentumScore: -1 }), "WAIT")).toMatchObject({
      blocked: false,
      reasons: [],
    });
  });
});
