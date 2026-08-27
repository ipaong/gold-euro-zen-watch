import { normalizeProviderCandle, validateMarketDataFeed, type MarketDataFeed } from "./contract";
import { timeframeMs, type MarketTimeframe } from "./provider";

export const YAHOO_CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart" as const;
export const YAHOO_SOURCE = "yahoo-finance" as const;
export const YAHOO_VERSION = "1.0.0" as const;

export interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[] | null;
    error?: { code?: string; description?: string | null } | null;
  };
}

export interface YahooChartResult {
  meta?: {
    currency?: string;
    symbol?: string;
    exchangeName?: string;
    fullExchangeName?: string;
    instrumentType?: string;
    shortName?: string;
    dataGranularity?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
}

export interface YahooParseOptions {
  symbol: string;
  displayName: string;
  timeframe: Exclude<MarketTimeframe, "M15">;
  fetchedAt: number;
}

export function yahooRangeFor(timeframe: YahooParseOptions["timeframe"]): string {
  switch (timeframe) {
    case "1m":
      return "7d";
    case "5m":
      return "60d";
    case "15m":
      // Five days already clears the 240-candle EMA warm-up at 15m and is
      // less likely to trigger public-endpoint rate limits than 60d.
      return "5d";
    case "1h":
      return "2y";
    case "1d":
      return "10y";
  }
}

function canonicalSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function parseEpochSeconds(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Yahoo timestamp ไม่ถูกต้อง");
  return parsed * 1000;
}

function parsePrice(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Yahoo OHLC มีค่าไม่ถูกต้อง");
  return parsed;
}

function responseError(response: YahooChartResponse): string {
  const error = response.chart?.error;
  const code = error?.code ? ` (${error.code})` : "";
  return `Yahoo Chart ตอบกลับข้อผิดพลาด${code}: ${error?.description ?? "ไม่พบข้อมูล chart"}`;
}

function isYahooChartResult(value: unknown): value is YahooChartResult {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/**
 * Convert Yahoo's parallel timestamp/quote arrays into the normalized app
 * contract. Yahoo Chart data is treated as delayed and only candles whose
 * interval has completed before fetchedAt are allowed into analysis.
 */
export function parseYahooChartResponse(
  response: YahooChartResponse,
  options: YahooParseOptions,
): MarketDataFeed {
  if (!Number.isFinite(options.fetchedAt) || options.fetchedAt <= 0) {
    throw new Error("Yahoo fetchedAt ไม่ถูกต้อง");
  }

  const result = response.chart?.result?.[0];
  if (!isYahooChartResult(result)) throw new Error(responseError(response));

  const providerSymbol = result.meta?.symbol?.trim() ?? "";
  if (canonicalSymbol(providerSymbol) !== canonicalSymbol(options.symbol)) {
    throw new Error(`Yahoo ส่ง symbol ไม่ตรง: ${providerSymbol || "ว่าง"}`);
  }
  const expectedGranularity = options.timeframe;
  if (result.meta?.dataGranularity && result.meta.dataGranularity !== expectedGranularity) {
    throw new Error(
      `Yahoo ส่ง granularity ไม่ตรง: ${result.meta.dataGranularity} ต้องการ ${expectedGranularity}`,
    );
  }

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote || !Array.isArray(timestamps)) throw new Error("Yahoo response ไม่มี timestamp/quote");

  const interval = timeframeMs(options.timeframe);
  const byTime = new Map<number, ReturnType<typeof normalizeProviderCandle>>();
  for (let i = 0; i < timestamps.length; i += 1) {
    const rawTime = timestamps[i];
    if (!Number.isFinite(rawTime)) continue;
    const time = parseEpochSeconds(rawTime);
    if (time + interval > options.fetchedAt) continue;

    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (![open, high, low, close].every((value) => value !== null && value !== undefined)) continue;

    const candle = normalizeProviderCandle({
      time,
      open: parsePrice(open),
      high: parsePrice(high),
      low: parsePrice(low),
      close: parsePrice(close),
      complete: true,
      sourceSymbol: providerSymbol,
    });
    // Duplicate timestamps are deterministically replaced by the last valid row.
    byTime.set(time, candle);
  }

  const candles = [...byTime.values()].sort((a, b) => a.t - b.t);
  if (!candles.length) throw new Error("Yahoo response ไม่มีแท่งที่ปิดแล้วและผ่าน OHLC validation");

  const feed: MarketDataFeed = {
    symbol: options.symbol,
    providerSymbol,
    displayName: options.displayName,
    timeframe: options.timeframe,
    intervalMs: interval,
    source: `${YAHOO_SOURCE}-${canonicalSymbol(options.symbol).toLowerCase()}`,
    sourceType: "delayed",
    delayed: true,
    demo: false,
    fetchedAt: candles[candles.length - 1]!.t,
    candles,
  };
  const validation = validateMarketDataFeed(feed, options.fetchedAt);
  if (!validation.valid) {
    throw new Error(`ข้อมูล Yahoo ไม่ผ่าน validation: ${validation.errors.slice(0, 3).join("; ")}`);
  }
  return feed;
}
