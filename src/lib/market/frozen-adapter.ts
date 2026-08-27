import { frozenMarketProvider } from "./frozen-provider";
import type { ReadOnlyMarketDataProvider } from "./contract";

/** Adapter fixture for the normalized boundary; it intentionally remains DEMO. */
export const frozenReadOnlyProvider: ReadOnlyMarketDataProvider = {
  id: "frozen-demo-read-only",
  label: "ชุดข้อมูลเดโม (read-only)",
  demo: true,
  async getFeed(asOf, limit) {
    return {
      symbol: "XAUEUR",
      timeframe: "M15",
      source: frozenMarketProvider.id,
      demo: true,
      fetchedAt: Date.now(),
      candles: frozenMarketProvider.getCandlesUpTo(asOf, limit).map((candle) => ({
        ...candle,
        closed: true,
        sourceSymbol: "XAUEUR",
      })),
    };
  },
};
