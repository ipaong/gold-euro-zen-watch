import type { Candle } from "../types";

/** Supported Yahoo-style intervals plus the legacy M15 spelling. */
export type MarketTimeframe = "1m" | "5m" | "15m" | "1h" | "1d" | "M15";

export const M15_MS = 15 * 60 * 1000;

export const TIMEFRAME_MS: Record<MarketTimeframe, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": M15_MS,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  M15: M15_MS,
};

export function timeframeMs(timeframe: MarketTimeframe): number {
  return TIMEFRAME_MS[timeframe];
}

/**
 * Market data abstraction. Providers expose only validated, read-only candles;
 * no provider may place orders or mutate a prediction.
 */
export interface MarketDataProvider {
  readonly id: string;
  readonly label: string;
  readonly symbol: string;
  readonly providerSymbol: string;
  readonly timeframe: MarketTimeframe;
  readonly intervalMs: number;
  readonly sourceType: "live" | "delayed" | "demo";
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
