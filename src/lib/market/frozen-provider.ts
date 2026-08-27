import dataset from "../../data/xaueur-m15.json";
import type { Candle } from "../types";
import { M15_MS } from "./provider";
import type { MarketDataProvider } from "./provider";

/**
 * Reads the pre-generated, frozen demo dataset as if it were an external feed.
 * It contains no forecasting logic — the forecast engine must treat this as
 * outside data so Time Machine results are not artificially accurate.
 */
const raw = dataset.candles as [number, number, number, number, number][];

const candles: Candle[] = raw.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));


function upperBound(timestamp: number): number {
  // index of first candle with t > timestamp (binary search)
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid]!.t <= timestamp) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const frozenMarketProvider: MarketDataProvider = {
  id: "frozen-demo",
  label: "ชุดข้อมูลเดโม (ตรึงค่า)",
  demo: true,
  getCandlesUpTo(timestamp, limit) {
    const end = upperBound(timestamp);
    const slice = candles.slice(0, end);
    return limit && slice.length > limit ? slice.slice(-limit) : slice;
  },
  getCandlesAfter(timestamp, count) {
    const start = upperBound(timestamp);
    return candles.slice(start, start + count);
  },
  getLatestTime() {
    return candles[candles.length - 1]!.t;
  },
  getEarliestTime() {
    return candles[0]!.t;
  },
};

export { M15_MS };

export const marketProvider = frozenMarketProvider;
