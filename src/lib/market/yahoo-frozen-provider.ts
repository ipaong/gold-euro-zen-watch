import dataset from "../../data/gc-f-15m.json";
import type { Candle } from "../types";
import { M15_MS, type MarketDataProvider } from "./provider";

/**
 * Explicitly labeled GC=F snapshot used only when Yahoo is unavailable or
 * warming. It is not live and is not an XM execution-price substitute.
 */
const raw = dataset.candles as [number, number, number, number, number][];
const candles: Candle[] = raw.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));

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

export const frozenYahooGoldProvider: MarketDataProvider = {
  id: "frozen-demo-yahoo-gc-f",
  label: "ชุดข้อมูลเดโม GC=F (Yahoo snapshot)",
  symbol: "GC=F",
  providerSymbol: "GC=F",
  timeframe: "15m",
  intervalMs: M15_MS,
  sourceType: "demo",
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
