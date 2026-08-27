import type { Candle } from "../types";
import { recordMetric } from "../observability";
import { timeframeMs, type MarketTimeframe } from "./provider";

/** Legacy names retained for historical callers; active feeds declare metadata directly. */
export const MARKET_SYMBOL = "XAUEUR" as const;
export const MARKET_TIMEFRAME = "M15" as const;

export type MarketSourceType = "live" | "delayed" | "demo";

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
  /** Internal analysis symbol, e.g. GC=F or XAUEUR. */
  symbol: string;
  /** Exact ticker returned by the upstream provider, e.g. GC=F or XAU/EUR. */
  providerSymbol: string;
  /** Human-readable instrument label; never imply broker equivalence. */
  displayName: string;
  timeframe: MarketTimeframe;
  intervalMs: number;
  source: string;
  sourceType: MarketSourceType;
  /** True when the source is delayed rather than real-time. */
  delayed: boolean;
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

/** Small allowance for clock skew while still rejecting look-ahead data. */
export const FUTURE_TIMESTAMP_TOLERANCE_MS = 60 * 1000;

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
  if (typeof input.complete !== "boolean")
    throw new Error("market candle complete flag must be boolean");
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

function validSourceType(value: unknown): value is MarketSourceType {
  return value === "live" || value === "delayed" || value === "demo";
}

/**
 * Validates the boundary between a vendor adapter and the analysis engine.
 * Gaps are warnings rather than hard failures because market sessions can
 * legitimately pause; callers must still surface the warning to users.
 */
export function validateMarketDataFeed(
  feed: MarketDataFeed,
  now = Date.now(),
  staleAfterMs?: number,
): MarketDataValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const interval =
    Number.isFinite(feed.intervalMs) && feed.intervalMs > 0
      ? feed.intervalMs
      : timeframeMs(feed.timeframe);

  if (!feed.symbol.trim()) errors.push("market feed is missing symbol");
  if (!feed.providerSymbol.trim()) errors.push("market feed is missing provider symbol");
  if (!feed.displayName.trim()) errors.push("market feed is missing display name");
  if (!validSourceType(feed.sourceType)) errors.push("market feed has an invalid source type");
  if (feed.demo !== (feed.sourceType === "demo")) {
    errors.push("market feed demo/source type metadata is inconsistent");
  }
  if (feed.delayed !== (feed.sourceType === "delayed")) {
    errors.push("market feed delayed/source type metadata is inconsistent");
  }
  if (!feed.source.trim()) errors.push("market feed is missing source");
  if (!Number.isFinite(feed.fetchedAt) || feed.fetchedAt <= 0) errors.push("invalid fetchedAt");
  if (!Number.isFinite(interval) || interval <= 0) errors.push("invalid interval");
  if (interval > 0 && timeframeMs(feed.timeframe) !== interval) {
    errors.push(`timeframe interval mismatch: ${feed.timeframe}/${feed.intervalMs}`);
  }
  if (!feed.candles.length) errors.push("market feed contains no candles");
  if (Number.isFinite(feed.fetchedAt) && feed.fetchedAt > now + FUTURE_TIMESTAMP_TOLERANCE_MS) {
    errors.push("market feed fetchedAt is in the future");
  }

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
    if (candle.sourceSymbol !== feed.providerSymbol) {
      errors.push(`${candle.t}: candle source symbol does not match feed provider symbol`);
    }
    if (!candle.closed) errors.push(`${candle.t}: open candle is not allowed in analysis`);
    if (candle.t > now + FUTURE_TIMESTAMP_TOLERANCE_MS) {
      errors.push(`${candle.t}: candle timestamp is in the future`);
    }
    if (previous) {
      const delta = candle.t - previous.t;
      if (delta <= 0) errors.push(`${candle.t}: candles are not strictly ordered`);
      else if (interval > 0 && delta !== interval)
        warnings.push(
          `${previous.t}: missing or skipped ${feed.timeframe} interval before ${candle.t}`,
        );
    }
    previous = candle;
  }

  const maxAge = staleAfterMs ?? (interval > 0 ? 2 * interval : 30 * 60 * 1000);
  const stale = Number.isFinite(feed.fetchedAt) && now - feed.fetchedAt > maxAge;
  if (stale) {
    warnings.push(`market feed is stale by more than ${Math.round(maxAge / 60000)} minutes`);
    recordMetric("stale_market", { source: feed.source, staleAfterMinutes: maxAge / 60000 });
  }

  return { valid: errors.length === 0, stale, errors, warnings };
}

/** Return only closed candles that were already known at `asOf`. */
export function getClosedCandlesUpTo(feed: MarketDataFeed, asOf: number): MarketDataCandle[] {
  return feed.candles.filter((candle) => candle.closed && candle.t <= asOf);
}
