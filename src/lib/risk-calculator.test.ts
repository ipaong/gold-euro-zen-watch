import { describe, expect, it } from "vitest";

import { calculateSafeBuffer } from "./risk-calculator";

describe("calculateSafeBuffer", () => {
  it("flags danger when balance is lower than normal ATR swing", () => {
    // Current price 2000, invalidation 1990 (10 points), ATR 7 points
    // 0.01 lot -> $1 per point -> ATR swing = $7, maxLoss = $10
    // Balance = $5 (less than ATR swing $7)
    const result = calculateSafeBuffer({
      balance: 5,
      currency: "USD",
      lotSize: 0.01,
      currentPrice: 2000,
      invalidation: 1990,
      atr: 7,
    });

    expect(result.status).toBe("danger");
    expect(result.badgeLabel).toContain("อันตราย");
    expect(result.normalSwingUsd).toBe(7);
    expect(result.maxLossUsd).toBe(10);
  });

  it("calculates safe status when balance is generous", () => {
    // Balance = $100, maxLoss = $10 -> multiplier = 10x
    const result = calculateSafeBuffer({
      balance: 100,
      currency: "USD",
      lotSize: 0.01,
      currentPrice: 2000,
      invalidation: 1990,
      atr: 7,
    });

    expect(result.status).toBe("safe");
    expect(result.survivalMultiplier).toBe(10);
    expect(result.badgeLabel).toContain("ปลอดภัยมาก");
  });

  it("converts THB balance accurately", () => {
    // 3,550 THB at 35.5 rate = 100 USD
    const result = calculateSafeBuffer({
      balance: 3550,
      currency: "THB",
      lotSize: 0.01,
      currentPrice: 2000,
      invalidation: 1990,
      atr: 7,
      thbRate: 35.5,
    });

    expect(result.balanceUsd).toBeCloseTo(100, 1);
    expect(result.balanceThb).toBe(3550);
    expect(result.maxLossThb).toBeCloseTo(10 * 35.5, 1);
  });

  it("adjusts point value according to lot size", () => {
    // 0.10 lot = $10 per point
    const result = calculateSafeBuffer({
      balance: 500,
      currency: "USD",
      lotSize: 0.1,
      currentPrice: 2000,
      invalidation: 1990,
      atr: 7,
    });

    expect(result.pointValueUsd).toBe(10);
    expect(result.normalSwingUsd).toBe(70);
    expect(result.maxLossUsd).toBe(100);
    expect(result.survivalMultiplier).toBe(5);
    expect(result.status).toBe("safe");
  });
});
