import { describe, expect, it } from "vitest";

import { getClosedCandlesUpTo, normalizeProviderCandle, validateMarketDataFeed } from "./contract";
import type { MarketDataFeed } from "./contract";

function candle(time: number, close: number, closed = true) {
  return {
    t: time,
    o: close - 1,
    h: close + 1,
    l: close - 1,
    c: close,
    closed,
    sourceSymbol: "XAUEUR",
  };
}

const feed = (overrides: Partial<MarketDataFeed> = {}): MarketDataFeed => ({
  symbol: "XAUEUR",
  providerSymbol: "XAUEUR",
  displayName: "Fixture",
  timeframe: "M15",
  intervalMs: 15 * 60 * 1000,
  source: "fixture",
  sourceType: "demo",
  delayed: false,
  demo: true,
  fetchedAt: 1_000_000,
  candles: [candle(1_000_000, 100), candle(1_900_000, 101)],
  ...overrides,
});

describe("read-only market data contract", () => {
  it("normalizes valid OHLC values and rejects malformed candles", () => {
    expect(
      normalizeProviderCandle({
        time: 1_000_000,
        open: 99,
        high: 101,
        low: 98,
        close: 100,
        complete: true,
        sourceSymbol: "XAUEUR",
      }),
    ).toMatchObject({ t: 1_000_000, o: 99, h: 101, l: 98, c: 100, closed: true });
    expect(() =>
      normalizeProviderCandle({
        time: 1_000_000,
        open: 99,
        high: 98,
        low: 98,
        close: 100,
        complete: true,
        sourceSymbol: "XAUEUR",
      }),
    ).toThrow(/high/i);
    expect(() =>
      normalizeProviderCandle({
        time: 1_000_000,
        open: 99,
        high: 101,
        low: 98,
        close: 100,
        complete: "yes" as never,
        sourceSymbol: "XAUEUR",
      }),
    ).toThrow(/complete/i);
  });

  it("rejects open candles and catches out-of-order or duplicate timestamps", () => {
    const result = validateMarketDataFeed(
      feed({ candles: [candle(1_900_000, 101, false), candle(1_000_000, 100)] }),
      1_000_000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => /open candle/i.test(error))).toBe(true);
    expect(result.errors.some((error) => /ordered/i.test(error))).toBe(true);
  });

  it("reports skipped M15 intervals as warnings and stale fetched metadata", () => {
    const result = validateMarketDataFeed(
      feed({ candles: [candle(1_000_000, 100), candle(2_000_000, 101)] }),
      1_000_000 + 31 * 60 * 1000,
    );
    expect(result.valid).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.warnings.some((warning) => /missing/i.test(warning))).toBe(true);
  });

  it("rejects future candles and fetched metadata beyond the server tolerance", () => {
    const now = Date.parse("2026-08-27T00:00:00Z");
    const futureFeed = feed({
      symbol: "GC=F",
      providerSymbol: "GC=F",
      displayName: "Gold Futures (Yahoo proxy)",
      timeframe: "15m",
      source: "yahoo-finance-gc=f",
      sourceType: "delayed",
      delayed: true,
      demo: false,
      fetchedAt: now,
      candles: [candle(now - 15 * 60 * 1000, 100), candle(now + 2 * 60 * 1000, 101)],
    });
    const futureCandleResult = validateMarketDataFeed(futureFeed, now);
    expect(futureCandleResult.valid).toBe(false);
    expect(futureCandleResult.errors.some((error) => /future/i.test(error))).toBe(true);

    const futureFetchedAtResult = validateMarketDataFeed(
      feed({ fetchedAt: now + 2 * 60 * 1000 }),
      now,
    );
    expect(futureFetchedAtResult.valid).toBe(false);
    expect(futureFetchedAtResult.errors.some((error) => /future/i.test(error))).toBe(true);
  });

  it("does not expose candles after asOf", () => {
    const result = getClosedCandlesUpTo(feed(), 1_000_000);
    expect(result.map((item) => item.t)).toEqual([1_000_000]);
  });
});
