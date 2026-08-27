import { frozenMarketProvider } from "./frozen-provider";
import type { ReadOnlyMarketDataProvider } from "./contract";

/** Adapter fixture for the normalized boundary; it intentionally remains DEMO. */
export const frozenReadOnlyProvider: ReadOnlyMarketDataProvider = {
  id: frozenMarketProvider.id,
  label: frozenMarketProvider.label,
  demo: true,
  async getFeed(asOf, limit) {
    return {
      symbol: frozenMarketProvider.symbol,
      providerSymbol: frozenMarketProvider.providerSymbol,
      displayName: frozenMarketProvider.label,
      timeframe: frozenMarketProvider.timeframe,
      intervalMs: frozenMarketProvider.intervalMs,
      source: frozenMarketProvider.id,
      sourceType: "demo",
      delayed: false,
      demo: true,
      fetchedAt: Date.now(),
      candles: frozenMarketProvider.getCandlesUpTo(asOf, limit).map((candle) => ({
        ...candle,
        closed: true,
        sourceSymbol: frozenMarketProvider.providerSymbol,
      })),
    };
  },
};
