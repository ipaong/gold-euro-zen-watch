import { describe, expect, it } from "vitest";

import { createFeedMarketProvider } from "./feed-provider";
import { parseTwelveDataTimeSeries } from "./twelvedata";

const fetchedAt = Date.parse("2026-08-27T00:45:00Z");

function row(datetime: string, close: number, is_complete = true) {
  return {
    datetime,
    open: String(close - 1),
    high: String(close + 1),
    low: String(close - 2),
    close: String(close),
    is_complete,
  };
}

describe("Twelve Data market adapter", () => {
  it("normalizes descending XAU/EUR response into ascending UTC closed candles", () => {
    const feed = parseTwelveDataTimeSeries(
      {
        status: "ok",
        meta: { symbol: "XAU/EUR", interval: "15min" },
        values: [
          row("2026-08-27 00:30:00", 3954),
          row("2026-08-27 00:15:00", 3953),
          row("2026-08-27 00:00:00", 3952),
        ],
      },
      fetchedAt,
    );

    expect(feed).toMatchObject({
      symbol: "XAUEUR",
      timeframe: "M15",
      source: "twelvedata",
      demo: false,
    });
    expect(feed.candles.map((candle) => candle.t)).toEqual([
      Date.parse("2026-08-27T00:00:00Z"),
      Date.parse("2026-08-27T00:15:00Z"),
      Date.parse("2026-08-27T00:30:00Z"),
    ]);
    expect(feed.candles.every((candle) => candle.closed)).toBe(true);
    expect(feed.candles[0]).toMatchObject({ o: 3951, h: 3953, l: 3950, c: 3952 });
  });

  it("excludes a provider-marked open candle and still rejects wrong symbols", () => {
    const feed = parseTwelveDataTimeSeries(
      {
        status: "ok",
        meta: { symbol: "XAU/EUR", interval: "15min" },
        values: [row("2026-08-27 00:45:00", 3955, false), row("2026-08-27 00:30:00", 3954)],
      },
      fetchedAt,
    );
    expect(feed.candles.map((candle) => candle.c)).toEqual([3954]);

    expect(() =>
      parseTwelveDataTimeSeries(
        {
          status: "ok",
          meta: { symbol: "XAU/USD", interval: "15min" },
          values: [row("2026-08-27 00:30:00", 3954)],
        },
        fetchedAt,
      ),
    ).toThrow(/symbol/i);
  });

  it("keeps the synchronous provider boundary free of future candles", () => {
    const feed = parseTwelveDataTimeSeries(
      {
        status: "ok",
        meta: { symbol: "XAU/EUR", interval: "15min" },
        values: [row("2026-08-27 00:30:00", 3954), row("2026-08-27 00:15:00", 3953)],
      },
      fetchedAt,
    );
    const provider = createFeedMarketProvider(feed);
    const asOf = Date.parse("2026-08-27T00:15:00Z");
    expect(provider.getCandlesUpTo(asOf).map((candle) => candle.c)).toEqual([3953]);
    expect(provider.getCandlesAfter(asOf, 2).map((candle) => candle.c)).toEqual([3954]);
  });
});
