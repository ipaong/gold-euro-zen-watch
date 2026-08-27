import { describe, expect, it } from "vitest";

import { parseYahooChartResponse, yahooRangeFor } from "./yahoo";

const fetchedAt = Date.parse("2026-08-27T00:45:00Z");
const t0015 = Math.floor(Date.parse("2026-08-27T00:15:00Z") / 1000);
const t0030 = Math.floor(Date.parse("2026-08-27T00:30:00Z") / 1000);
const t0045 = Math.floor(Date.parse("2026-08-27T00:45:00Z") / 1000);

function response(
  timestamps: number[],
  closes: Array<number | null>,
  symbol = "GC=F",
): Parameters<typeof parseYahooChartResponse>[0] {
  return {
    chart: {
      result: [
        {
          meta: { symbol, dataGranularity: "15m", instrumentType: "FUTURE" },
          timestamp: timestamps,
          indicators: {
            quote: [
              {
                open: closes.map((close) => (close === null ? null : close - 1)),
                high: closes.map((close) => (close === null ? null : close + 1)),
                low: closes.map((close) => (close === null ? null : close - 2)),
                close: closes,
              },
            ],
          },
        },
      ],
    },
  };
}

describe("Yahoo Chart market adapter", () => {
  it("normalizes parallel arrays, sorts timestamps, drops the open candle, and removes duplicates", () => {
    const feed = parseYahooChartResponse(
      response([t0045, t0030, t0030, t0015], [105, 104, 106, 103]),
      {
        symbol: "GC=F",
        displayName: "Gold Futures (Yahoo proxy)",
        timeframe: "15m",
        fetchedAt,
      },
    );

    expect(feed).toMatchObject({
      symbol: "GC=F",
      providerSymbol: "GC=F",
      displayName: "Gold Futures (Yahoo proxy)",
      timeframe: "15m",
      intervalMs: 15 * 60 * 1000,
      sourceType: "delayed",
      delayed: true,
      demo: false,
    });
    expect(feed.candles.map((candle) => candle.t)).toEqual([
      Date.parse("2026-08-27T00:15:00Z"),
      Date.parse("2026-08-27T00:30:00Z"),
    ]);
    expect(feed.candles.map((candle) => candle.c)).toEqual([103, 106]);
    expect(feed.candles.every((candle) => candle.closed)).toBe(true);
    expect(feed.fetchedAt).toBe(Date.parse("2026-08-27T00:30:00Z"));
    expect(feed.fetchedAt).not.toBe(fetchedAt);
  });

  it("rejects a mismatched symbol and malformed OHLC data", () => {
    expect(() =>
      parseYahooChartResponse(response([t0030], [104], "SI=F"), {
        symbol: "GC=F",
        displayName: "Gold Futures (Yahoo proxy)",
        timeframe: "15m",
        fetchedAt,
      }),
    ).toThrow(/symbol/i);

    const malformed = response([t0030], [104]);
    malformed.chart!.result![0]!.indicators!.quote![0]!.high![0] = 100;
    expect(() =>
      parseYahooChartResponse(malformed, {
        symbol: "GC=F",
        displayName: "Gold Futures (Yahoo proxy)",
        timeframe: "15m",
        fetchedAt,
      }),
    ).toThrow(/high|validation/i);
  });

  it("supports the bounded Yahoo range policy for each interval", () => {
    expect(yahooRangeFor("1m")).toBe("7d");
    expect(yahooRangeFor("5m")).toBe("60d");
    expect(yahooRangeFor("15m")).toBe("5d");
    expect(yahooRangeFor("1h")).toBe("2y");
    expect(yahooRangeFor("1d")).toBe("10y");
  });
});
