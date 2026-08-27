import { describe, expect, it } from "vitest";

import { resultFromValidatedFeed } from "./market.functions";
import type { MarketDataFeed } from "./market/contract";
import { MIN_WARMUP_CANDLES } from "./market/provider";

function feed(count: number, overrides: Partial<MarketDataFeed> = {}): MarketDataFeed {
  const start = Date.parse("2026-08-27T00:00:00Z");
  const candles = Array.from({ length: count }, (_, index) => {
    const t = start + index * 15 * 60 * 1000;
    const base = 3300 + index * 0.1;
    return {
      t,
      o: base,
      h: base + 1,
      l: base - 1,
      c: base + 0.5,
      v: 1,
      closed: true,
      sourceSymbol: "GC=F",
    };
  });
  return {
    symbol: "GC=F",
    providerSymbol: "GC=F",
    displayName: "Gold Futures (Yahoo Finance)",
    timeframe: "15m",
    intervalMs: 15 * 60 * 1000,
    source: "yahoo-finance-gc=f",
    sourceType: "delayed",
    delayed: true,
    demo: false,
    fetchedAt: start + (count - 1) * 15 * 60 * 1000,
    candles,
    ...overrides,
  };
}

describe("market result readiness and fallback", () => {
  it("returns a usable feed only at the 240-candle warmup gate", () => {
    const warming = resultFromValidatedFeed(
      feed(MIN_WARMUP_CANDLES - 1),
      Date.parse("2026-08-29T12:00:00Z"),
    );
    expect(warming.feed).toBeNull();
    expect(warming.health.status).toBe("empty");
    expect(warming.fallbackReason).toContain("239/240");

    const ready = resultFromValidatedFeed(
      feed(MIN_WARMUP_CANDLES),
      Date.parse("2026-08-29T12:00:00Z"),
    );
    expect(ready.feed).not.toBeNull();
    expect(ready.health.status).toBe("ok");
  });

  it("rejects stale data and does not turn it into a successful feed", () => {
    const stale = resultFromValidatedFeed(
      feed(240, { fetchedAt: Date.parse("2026-08-27T00:00:00Z") }),
      Date.parse("2026-08-30T00:00:00Z"),
    );
    expect(stale.feed).toBeNull();
    expect(stale.health.status).toBe("error");
    expect(stale.fallbackReason).toContain("ค้าง");
  });

  it("uses a provider-specific action instead of claiming DEMO fallback", () => {
    const xmStale = resultFromValidatedFeed(
      feed(240, {
        symbol: "GOLD",
        providerSymbol: "GOLD",
        displayName: "XM GOLD (MT5 bridge)",
        source: "xm-mt5",
        sourceType: "live",
        delayed: false,
        demo: false,
        candles: feed(240).candles.map((candle) => ({ ...candle, sourceSymbol: "GOLD" })),
      }),
      Date.parse("2026-08-30T12:00:00Z"),
      MIN_WARMUP_CANDLES,
      "จึงหยุดการวิเคราะห์",
    );
    expect(xmStale.feed).toBeNull();
    expect(xmStale.fallbackReason).toContain("หยุดการวิเคราะห์");
    expect(xmStale.fallbackReason).not.toContain("DEMO fallback");
  });

  it("rejects metadata/source mismatches before readiness can pass", () => {
    const mismatch = resultFromValidatedFeed(
      feed(240, {
        candles: feed(240).candles.map((candle, index) =>
          index === 12 ? { ...candle, sourceSymbol: "XAUEUR" } : candle,
        ),
      }),
      Date.parse("2026-08-29T12:00:00Z"),
    );
    expect(mismatch.feed).toBeNull();
    expect(mismatch.health.status).toBe("error");
    expect(mismatch.fallbackReason).toContain("source symbol");
  });
});
