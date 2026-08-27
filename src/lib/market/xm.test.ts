import { describe, expect, it } from "vitest";

import {
  feedFromXmRows,
  parseXmBridgePayload,
  parseXmCandleRow,
  XM_MT5_SOURCE,
  XM_MT5_VERSION,
} from "./xm";

const NOW = Date.parse("2026-08-28T12:00:00.000Z");
const T0 = Date.parse("2026-08-28T10:00:00.000Z") / 1000;

function bridgeCandle(overrides: Record<string, unknown> = {}) {
  return {
    time_seconds: T0,
    open: 4600,
    high: 4608,
    low: 4598,
    close: 4605,
    complete: true,
    symbol: "GOLD",
    timeframe: "15m",
    ...overrides,
  };
}

function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    source: XM_MT5_SOURCE,
    version: XM_MT5_VERSION,
    symbol: "GOLD",
    timeframe: "15m",
    bucket_start: new Date(T0 * 1000).toISOString(),
    open: "4600",
    high: "4608",
    low: "4598",
    close: "4605",
    is_closed: true,
    ...overrides,
  };
}

describe("XM MT5 bridge contract", () => {
  it("accepts ascending closed GOLD M15 bars", () => {
    const payload = parseXmBridgePayload(
      {
        source: XM_MT5_SOURCE,
        version: XM_MT5_VERSION,
        symbol: "GOLD",
        timeframe: "15m",
        candles: [bridgeCandle(), bridgeCandle({ time_seconds: T0 + 900, high: 4612, close: 4610 })],
      },
      NOW,
    );

    expect(payload.candles).toHaveLength(2);
    expect(payload.candles[1]?.time_seconds).toBe(T0 + 900);
  });

  it.each([
    ["wrong source", { source: "yahoo" }, /source/],
    ["wrong symbol", { symbol: "XAUEUR" }, /symbol/],
    ["wrong timeframe", { timeframe: "1h" }, /timeframe/],
  ])("rejects %s envelope", (_label, override, expected) => {
    expect(() =>
      parseXmBridgePayload(
        {
          source: XM_MT5_SOURCE,
          version: XM_MT5_VERSION,
          symbol: "GOLD",
          timeframe: "15m",
          candles: [bridgeCandle()],
          ...override,
        },
        NOW,
      ),
    ).toThrow(expected);
  });

  it("rejects open bars, duplicate/reversed bars and oversized batches", () => {
    expect(() => parseXmBridgePayload({
      source: XM_MT5_SOURCE,
      version: XM_MT5_VERSION,
      symbol: "GOLD",
      timeframe: "15m",
      candles: [bridgeCandle({ complete: false })],
    }, NOW)).toThrow(/ปิดแล้ว/);

    expect(() => parseXmBridgePayload({
      source: XM_MT5_SOURCE,
      version: XM_MT5_VERSION,
      symbol: "GOLD",
      timeframe: "15m",
      candles: [bridgeCandle(), bridgeCandle()],
    }, NOW)).toThrow(/เรียงเวลา/);

    expect(() => parseXmBridgePayload({
      source: XM_MT5_SOURCE,
      version: XM_MT5_VERSION,
      symbol: "GOLD",
      timeframe: "15m",
      candles: [bridgeCandle({ time_seconds: T0 + 900 }), bridgeCandle()],
    }, NOW)).toThrow(/เรียงเวลา/);

    expect(() => parseXmBridgePayload({
      source: XM_MT5_SOURCE,
      version: XM_MT5_VERSION,
      symbol: "GOLD",
      timeframe: "15m",
      candles: Array.from({ length: 601 }, (_, index) => bridgeCandle({ time_seconds: T0 + index * 900 })),
    }, NOW)).toThrow(/600/);
  });

  it("rejects malformed OHLC, unaligned timestamps and future bars", () => {
    expect(() => parseXmBridgePayload({
      source: XM_MT5_SOURCE,
      version: XM_MT5_VERSION,
      symbol: "GOLD",
      timeframe: "15m",
      candles: [bridgeCandle({ high: 4599 })],
    }, NOW)).toThrow(/high/);

    expect(() => parseXmBridgePayload({
      source: XM_MT5_SOURCE,
      version: XM_MT5_VERSION,
      symbol: "GOLD",
      timeframe: "15m",
      candles: [bridgeCandle({ time_seconds: T0 + 60 })],
    }, NOW)).toThrow(/align/);

    const future = Math.floor(NOW / (15 * 60 * 1000)) * 15 * 60 + 15 * 60;
    expect(() => parseXmBridgePayload({
      source: XM_MT5_SOURCE,
      version: XM_MT5_VERSION,
      symbol: "GOLD",
      timeframe: "15m",
      candles: [bridgeCandle({ time_seconds: future })],
    }, NOW)).toThrow(/อนาคต/);
  });

  it("rebuilds a source-faithful normalized feed from closed rows", () => {
    const feed = feedFromXmRows(
      [
        dbRow({
          bucket_start: new Date((T0 + 900) * 1000).toISOString(),
          high: "4612",
          close: "4610",
        }),
        dbRow(),
      ],
      NOW,
    );

    expect(feed).toMatchObject({
      symbol: "GOLD",
      providerSymbol: "GOLD",
      displayName: "XM GOLD (MT5 bridge)",
      timeframe: "15m",
      source: XM_MT5_SOURCE,
      sourceType: "live",
      delayed: false,
      demo: false,
      fetchedAt: (T0 + 900) * 1000,
    });
    expect(feed.candles.map((candle) => candle.t)).toEqual([T0 * 1000, (T0 + 900) * 1000]);
  });

  it("rejects non-XM or open rows from Supabase", () => {
    expect(() => parseXmCandleRow(dbRow({ source: "gold-api-xau-eur" }))).toThrow(/source/);
    expect(() => parseXmCandleRow(dbRow({ is_closed: false }))).toThrow(/closed/);
  });
});
