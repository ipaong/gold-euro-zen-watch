import type { Candle } from "../types";

/**
 * Market data abstraction. Phase 1 ships a frozen demo dataset provider.
 * Later phases can add an MT5-bridge / broker / market-data-API provider
 * without touching UI or analysis code.
 */
export const M15_MS = 15 * 60 * 1000;

export interface MarketDataProvider {
  readonly id: string;
  readonly label: string;
  /** true when the data is demo/synthetic and must be labelled in the UI. */
  readonly demo: boolean;
  /** Candles with open time <= timestamp. Never returns future data. */
  getCandlesUpTo(timestamp: number, limit?: number): Candle[];
  /** Candles strictly after timestamp — only for revealing/scoring, never for analysis. */
  getCandlesAfter(timestamp: number, count: number): Candle[];
  /** Latest candle time available in the source. */
  getLatestTime(): number;
  getEarliestTime(): number;
}

/** EMA200 + slope needs a solid warm-up before any number is trustworthy. */
export const MIN_WARMUP_CANDLES = 240;
