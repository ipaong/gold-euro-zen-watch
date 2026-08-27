import type { Candle } from "../types";
import { M15_MS } from "./frozen-provider";
import { recordMetric } from "../observability";

export const MARKET_SYMBOL = "XAUEUR" as const;
export const MARKET_TIMEFRAME = "M15" as const;

/** Raw shape an external adapter must map into the app contract. */
export interface ProviderCandleInput {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  complete: boolean;
  sourceSymbol: string;
}

export interface MarketDataCandle extends Candle {
  /** The upstream closed-candle flag; open candles must never enter analysis. */
  closed: boolean;
  sourceSymbol: string;
}

export interface MarketDataFeed {
  symbol: typeof MARKET_SYMBOL;
  timeframe: typeof MARKET_TIMEFRAME;
  source: string;
  demo: boolean;
  fetchedAt: number;
  candles: MarketDataCandle[];
}

export interface MarketDataValidation {
  valid: boolean;
  stale: boolean;
  errors: string[];
  warnings: string[];
}

export interface ReadOnlyMarketDataProvider {
  readonly id: string;
  readonly label: string;
  readonly demo: boolean;
  getFeed(asOf: number, limit?: number): Promise<MarketDataFeed>;
}

export function normalizeProviderCandle(input: ProviderCandleInput): MarketDataCandle {
  const values = [input.time, input.open, input.high, input.low, input.close];
  if (!values.every(Number.isFinite)) throw new Error("market candle contains a non-finite value");
  if (!input.sourceSymbol.trim()) throw new Error("market candle is missing source symbol");
  if (input.high < Math.max(input.open, input.close))
    throw new Error("candle high is below open/close");
  if (input.low > Math.min(input.open, input.close))
    throw new Error("candle low is above open/close");
  if (input.time <= 0 || !Number.isFinite(new Date(input.time).getTime())) {
    throw new Error("market candle timestamp must be a valid UTC epoch");
  }
  return {
    t: input.time,
    o: input.open,
    h: input.high,
    l: input.low,
    c: input.close,
    closed: input.complete,
    sourceSymbol: input.sourceSymbol,
  };
}

/**
 * Validates the boundary between a vendor adapter and the analysis engine.
 * Gaps are warnings rather than hard failures because market sessions can
 * legitimately pause; callers must still surface the warning to users.
 */
export function validateMarketDataFeed(
  feed: MarketDataFeed,
  now = Date.now(),
  staleAfterMs = 2 * M15_MS,
): MarketDataValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (feed.symbol !== MARKET_SYMBOL) errors.push(`unsupported symbol: ${feed.symbol}`);
  if (feed.timeframe !== MARKET_TIMEFRAME) errors.push(`unsupported timeframe: ${feed.timeframe}`);
  if (!feed.source.trim()) errors.push("market feed is missing source");
  if (!Number.isFinite(feed.fetchedAt) || feed.fetchedAt <= 0) errors.push("invalid fetchedAt");
  if (!feed.candles.length) errors.push("market feed contains no candles");

  let previous: MarketDataCandle | undefined;
  for (const candle of feed.candles) {
    try {
      normalizeProviderCandle({
        time: candle.t,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
        complete: candle.closed,
        sourceSymbol: candle.sourceSymbol,
      });
    } catch (error) {
      errors.push(`${candle.t}: ${(error as Error).message}`);
    }
    if (!candle.closed) errors.push(`${candle.t}: open candle is not allowed in analysis`);
    if (previous) {
      const delta = candle.t - previous.t;
      if (delta <= 0) errors.push(`${candle.t}: candles are not strictly ordered`);
      else if (delta !== M15_MS)
        warnings.push(`${previous.t}: missing or skipped M15 interval before ${candle.t}`);
    }
    previous = candle;
  }

  const stale = Number.isFinite(feed.fetchedAt) && now - feed.fetchedAt > staleAfterMs;
  if (stale) {
    warnings.push(`market feed is stale by more than ${staleAfterMs / 60000} minutes`);
    recordMetric("stale_market", { source: feed.source, staleAfterMinutes: staleAfterMs / 60000 });
  }

  return { valid: errors.length === 0, stale, errors, warnings };
}

/** Return only closed candles that were already known at `asOf`. */
export function getClosedCandlesUpTo(feed: MarketDataFeed, asOf: number): MarketDataCandle[] {
  return feed.candles.filter((candle) => candle.closed && candle.t <= asOf);
}
