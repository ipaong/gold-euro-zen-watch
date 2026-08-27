import type { MarketDataFeed } from "./contract";
import type { MarketDataProvider } from "./provider";

/**
 * Turns one server-validated feed into the synchronous provider expected by
 * the existing indicator/forecast pipeline. The feed is already closed-only;
 * the extra timestamp filtering keeps the no-look-ahead boundary explicit.
 */
export function createFeedMarketProvider(feed: MarketDataFeed): MarketDataProvider {
  const candles = [...feed.candles]
    .filter((candle) => candle.closed)
    .sort((a, b) => a.t - b.t)
    .map(({ t, o, h, l, c }) => ({ t, o, h, l, c }));

  function upperBound(timestamp: number): number {
    let lo = 0;
    let hi = candles.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (candles[mid]!.t <= timestamp) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  return {
    id: feed.source,
    label: `${feed.source} · XAUEUR M15 (read-only)`,
    demo: false,
    getCandlesUpTo(timestamp, limit) {
      const visible = candles.slice(0, upperBound(timestamp));
      return limit && visible.length > limit ? visible.slice(-limit) : visible;
    },
    getCandlesAfter(timestamp, count) {
      return candles.slice(upperBound(timestamp), upperBound(timestamp) + count);
    },
    getLatestTime() {
      return candles[candles.length - 1]?.t ?? 0;
    },
    getEarliestTime() {
      return candles[0]?.t ?? 0;
    },
  };
}
